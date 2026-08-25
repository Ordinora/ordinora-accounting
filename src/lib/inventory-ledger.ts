import "server-only";
import { InventoryCostingMethod, Prisma } from "@prisma/client";
import { issueAtFifo, issueAtWeightedAverage, receiveAtWeightedAverage } from "./inventory-costing";

const zero = new Prisma.Decimal(0);

type Transaction = Prisma.TransactionClient;

type InventoryKey = {
  tenantId: string;
  itemId: string;
  locationId: string;
};

export async function receiveInventory(
  tx: Transaction,
  input: InventoryKey & {
    costingMethod: InventoryCostingMethod;
    receivedOn: Date;
    quantity: Prisma.Decimal;
    totalValue: Prisma.Decimal;
    sourceType: string;
    sourceId: string;
  },
) {
  const balance = await tx.inventoryBalance.upsert({
    where: { itemId_locationId: { itemId: input.itemId, locationId: input.locationId } },
    create: { itemId: input.itemId, locationId: input.locationId },
    update: {},
  });
  const received = receiveAtWeightedAverage({
    currentQuantity: balance.quantity,
    currentValue: balance.inventoryValue,
    receivedQuantity: input.quantity,
    receivedValue: input.totalValue,
  });
  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantity: received.newQuantity, inventoryValue: received.newValue },
  });
  if (input.costingMethod === "FIFO") {
    await tx.inventoryCostLayer.create({
      data: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        locationId: input.locationId,
        receivedOn: input.receivedOn,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        originalQuantity: input.quantity,
        remainingQuantity: input.quantity,
        unitCost: input.totalValue.div(input.quantity).toDecimalPlaces(6),
      },
    });
  }
  return received;
}

export async function issueInventory(
  tx: Transaction,
  input: InventoryKey & { costingMethod: InventoryCostingMethod; quantity: Prisma.Decimal },
) {
  const balance = await tx.inventoryBalance.upsert({
    where: { itemId_locationId: { itemId: input.itemId, locationId: input.locationId } },
    create: { itemId: input.itemId, locationId: input.locationId },
    update: {},
  });
  if (input.costingMethod === "WEIGHTED_AVERAGE") {
    const issued = issueAtWeightedAverage({
      currentQuantity: balance.quantity,
      currentValue: balance.inventoryValue,
      issuedQuantity: input.quantity,
    });
    await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: { quantity: issued.newQuantity, inventoryValue: issued.newValue },
    });
    return { cost: issued.issuedValue, unitCost: issued.averageUnitCost, consumptions: [] };
  }

  const layers = await tx.inventoryCostLayer.findMany({
    where: { tenantId: input.tenantId, itemId: input.itemId, locationId: input.locationId, remainingQuantity: { gt: zero } },
    orderBy: [{ receivedOn: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const issued = issueAtFifo({
    layers: layers.map((layer) => ({ id: layer.id, quantity: layer.remainingQuantity, unitCost: layer.unitCost })),
    issuedQuantity: input.quantity,
  });
  for (const consumption of issued.consumptions) {
    const layer = layers.find((candidate) => candidate.id === consumption.id);
    if (!layer) throw new Error("A FIFO inventory cost layer could not be resolved.");
    await tx.inventoryCostLayer.update({
      where: { id: layer.id },
      data: { remainingQuantity: layer.remainingQuantity.sub(consumption.quantity) },
    });
  }
  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantity: issued.remainingQuantity, inventoryValue: issued.remainingValue },
  });
  return { cost: issued.issuedValue, unitCost: issued.effectiveUnitCost, consumptions: issued.consumptions };
}

export async function convertBalancesToFifoLayers(tx: Transaction, tenantId: string, conversionDate: Date) {
  const balances = await tx.inventoryBalance.findMany({
    where: { item: { tenantId }, quantity: { gt: zero } },
  });
  await tx.inventoryCostLayer.deleteMany({ where: { tenantId } });
  for (const balance of balances) {
    await tx.inventoryCostLayer.create({
      data: {
        tenantId,
        itemId: balance.itemId,
        locationId: balance.locationId,
        receivedOn: conversionDate,
        sourceType: "COSTING_METHOD_CONVERSION",
        sourceId: tenantId,
        originalQuantity: balance.quantity,
        remainingQuantity: balance.quantity,
        unitCost: balance.inventoryValue.div(balance.quantity).toDecimalPlaces(6),
      },
    });
  }
  return balances.length;
}
