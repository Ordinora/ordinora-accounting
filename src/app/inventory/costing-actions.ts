"use server";

import { InventoryCostingMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { convertBalancesToFifoLayers } from "@/lib/inventory-ledger";
import { requireActiveTenant } from "@/lib/session";

export async function updateInventoryCostingMethod(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot change inventory costing settings.");
  const method = String(formData.get("method"));
  if (!Object.values(InventoryCostingMethod).includes(method as InventoryCostingMethod)) throw new Error("Select a valid inventory costing method.");
  const selected = method as InventoryCostingMethod;
  if (selected === active.inventoryCostingMethod) return;
  await db.$transaction(async (tx) => {
    const movementCount = await tx.inventoryMovement.count({ where: { tenantId: active.id } });
    if (selected === "WEIGHTED_AVERAGE" && movementCount > 0) throw new Error("A company with inventory history cannot switch from FIFO back to weighted average. Create a controlled conversion in a new accounting file instead.");
    const convertedLayers = selected === "FIFO" ? await convertBalancesToFifoLayers(tx, active.id, new Date()) : 0;
    await tx.tenant.update({ where: { id: active.id }, data: { inventoryCostingMethod: selected } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "INVENTORY_COSTING_METHOD_CHANGED", entityType: "Tenant", entityId: active.id, previousValues: { method: active.inventoryCostingMethod }, newValues: { method: selected, prospectiveConversionLayers: convertedLayers }, reason: movementCount ? "Prospective costing-method conversion using current quantity and carrying value" : "Initial inventory costing setup" } });
  });
  revalidatePath("/inventory");
  revalidatePath("/reports/inventory-costing-worksheet");
}
