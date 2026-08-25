import { Prisma } from "@prisma/client";

const zero = new Prisma.Decimal(0);

type DecimalInput = Prisma.Decimal.Value;

export type FifoLayerInput = {
  id?: string;
  quantity: DecimalInput;
  unitCost: DecimalInput;
};

function quantity(value: DecimalInput, label: string) {
  const parsed = new Prisma.Decimal(value);
  if (parsed.lt(0)) throw new Error(`${label} cannot be negative.`);
  return parsed;
}

function value(value: DecimalInput, label: string) {
  const parsed = new Prisma.Decimal(value);
  if (parsed.lt(0)) throw new Error(`${label} cannot be negative.`);
  return parsed;
}

export function receiveAtWeightedAverage(input: {
  currentQuantity: DecimalInput;
  currentValue: DecimalInput;
  receivedQuantity: DecimalInput;
  receivedValue: DecimalInput;
}) {
  const currentQuantity = quantity(input.currentQuantity, "Current quantity");
  const currentValue = value(input.currentValue, "Current inventory value");
  const receivedQuantity = quantity(input.receivedQuantity, "Received quantity");
  const receivedValue = value(input.receivedValue, "Received value");
  if (receivedQuantity.eq(0)) throw new Error("Received quantity must be greater than zero.");

  const newQuantity = currentQuantity.add(receivedQuantity);
  const newValue = currentValue.add(receivedValue);
  return {
    newQuantity,
    newValue,
    receiptUnitCost: receivedValue.div(receivedQuantity).toDecimalPlaces(4),
    averageUnitCost: newValue.div(newQuantity).toDecimalPlaces(4),
  };
}

export function issueAtWeightedAverage(input: {
  currentQuantity: DecimalInput;
  currentValue: DecimalInput;
  issuedQuantity: DecimalInput;
}) {
  const currentQuantity = quantity(input.currentQuantity, "Current quantity");
  const currentValue = value(input.currentValue, "Current inventory value");
  const issuedQuantity = quantity(input.issuedQuantity, "Issued quantity");
  if (issuedQuantity.eq(0)) throw new Error("Issued quantity must be greater than zero.");
  if (issuedQuantity.gt(currentQuantity)) throw new Error("Insufficient stock for the requested issue.");
  if (currentQuantity.eq(0)) throw new Error("Stock with zero quantity cannot be issued.");

  const averageUnitCost = currentValue.div(currentQuantity);
  const issuedValue = averageUnitCost.mul(issuedQuantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const newQuantity = currentQuantity.sub(issuedQuantity);
  const newValue = newQuantity.eq(0) ? zero : currentValue.sub(issuedValue);
  return { averageUnitCost: averageUnitCost.toDecimalPlaces(4), issuedValue, newQuantity, newValue };
}

export function consumeToPhysicalClosing(input: {
  currentQuantity: DecimalInput;
  currentValue: DecimalInput;
  closingQuantity: DecimalInput;
}) {
  const currentQuantity = quantity(input.currentQuantity, "Current quantity");
  const closingQuantity = quantity(input.closingQuantity, "Closing quantity");
  if (closingQuantity.gt(currentQuantity)) {
    throw new Error("Closing quantity exceeds book stock; record an inventory increase instead.");
  }
  if (closingQuantity.eq(currentQuantity)) {
    return { consumedQuantity: zero, consumedValue: zero, newQuantity: currentQuantity, newValue: value(input.currentValue, "Current inventory value"), averageUnitCost: zero };
  }
  const issued = issueAtWeightedAverage({
    currentQuantity,
    currentValue: input.currentValue,
    issuedQuantity: currentQuantity.sub(closingQuantity),
  });
  return {
    consumedQuantity: currentQuantity.sub(closingQuantity),
    consumedValue: issued.issuedValue,
    newQuantity: issued.newQuantity,
    newValue: issued.newValue,
    averageUnitCost: issued.averageUnitCost,
  };
}

export function issueAtFifo(input: { layers: FifoLayerInput[]; issuedQuantity: DecimalInput }) {
  const issuedQuantity = quantity(input.issuedQuantity, "Issued quantity");
  if (issuedQuantity.eq(0)) throw new Error("Issued quantity must be greater than zero.");
  const layers = input.layers.map((layer) => ({
    id: layer.id,
    quantity: quantity(layer.quantity, "FIFO layer quantity"),
    unitCost: value(layer.unitCost, "FIFO layer unit cost"),
  }));
  const available = layers.reduce((sum, layer) => sum.add(layer.quantity), zero);
  if (issuedQuantity.gt(available)) throw new Error("Insufficient stock for the requested FIFO issue.");

  let remaining = issuedQuantity;
  let issuedValue = zero;
  const consumptions: { id?: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal; value: Prisma.Decimal }[] = [];
  const remainingLayers: { id?: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal }[] = [];
  for (const layer of layers) {
    if (remaining.eq(0)) {
      remainingLayers.push(layer);
      continue;
    }
    const consumed = Prisma.Decimal.min(layer.quantity, remaining);
    const consumedValue = consumed.mul(layer.unitCost);
    consumptions.push({ id: layer.id, quantity: consumed, unitCost: layer.unitCost, value: consumedValue });
    issuedValue = issuedValue.add(consumedValue);
    remaining = remaining.sub(consumed);
    const layerRemainder = layer.quantity.sub(consumed);
    if (layerRemainder.gt(0)) remainingLayers.push({ ...layer, quantity: layerRemainder });
  }
  const roundedIssuedValue = issuedValue.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const remainingValue = remainingLayers.reduce((sum, layer) => sum.add(layer.quantity.mul(layer.unitCost)), zero).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return {
    issuedQuantity,
    issuedValue: roundedIssuedValue,
    effectiveUnitCost: roundedIssuedValue.div(issuedQuantity).toDecimalPlaces(4),
    consumptions,
    remainingLayers,
    remainingQuantity: available.sub(issuedQuantity),
    remainingValue,
  };
}

export function consumeFifoToPhysicalClosing(input: { layers: FifoLayerInput[]; closingQuantity: DecimalInput }) {
  const closingQuantity = quantity(input.closingQuantity, "Closing quantity");
  const currentQuantity = input.layers.reduce((sum, layer) => sum.add(quantity(layer.quantity, "FIFO layer quantity")), zero);
  if (closingQuantity.gt(currentQuantity)) throw new Error("Closing quantity exceeds book stock; record an inventory increase instead.");
  if (closingQuantity.eq(currentQuantity)) return { consumedQuantity: zero, consumedValue: zero, remainingQuantity: currentQuantity, remainingValue: input.layers.reduce((sum, layer) => sum.add(new Prisma.Decimal(layer.quantity).mul(layer.unitCost)), zero), consumptions: [] };
  const issued = issueAtFifo({ layers: input.layers, issuedQuantity: currentQuantity.sub(closingQuantity) });
  return { consumedQuantity: currentQuantity.sub(closingQuantity), consumedValue: issued.issuedValue, remainingQuantity: issued.remainingQuantity, remainingValue: issued.remainingValue, consumptions: issued.consumptions };
}
