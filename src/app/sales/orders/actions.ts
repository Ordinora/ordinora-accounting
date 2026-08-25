"use server";

import { Prisma, SalesOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { postCommercialDocument } from "@/lib/commercial";
import { convertForeignToBase } from "@/lib/currency";
import { db } from "@/lib/db";
import { resolveReference } from "@/lib/reference-numbers";
import { assertSalesOrderTransition } from "@/lib/sales-order";
import { calculateQuotationLines } from "@/lib/sales-quotation";
import { requireActiveTenant } from "@/lib/session";

const header = z.object({ customerId: z.string().cuid(), reference: z.string().trim().max(60).optional(), autoReference: z.string().optional(), quoteDate: z.coerce.date(), validUntil: z.coerce.date(), description: z.string().trim().min(2).max(500) });
function authorize(role: string | null | undefined) { if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot manage sales orders."); }
function linesFrom(formData: FormData) {
  const values = ["lineDescription", "lineAccountId", "lineQuantity", "lineUnitPrice", "lineDiscountPercent", "lineItemId", "lineLocationId"].map((key) => formData.getAll(key).map(String));
  if (!values[0].length || !values.every((value) => value.length === values[0].length)) throw new Error("Sales order lines are incomplete.");
  return calculateQuotationLines(values[0].map((description, index) => ({ description, accountId: values[1][index], quantity: values[2][index], unitPrice: values[3][index], discountPercent: values[4][index], itemId: values[5][index] || undefined, locationId: values[6][index] || undefined })));
}

export async function createSalesOrder(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole); const input = header.parse(Object.fromEntries(formData));
  if (input.validUntil < input.quoteDate) throw new Error("Expected fulfillment date cannot be before the order date.");
  const reference = await resolveReference({ tenantId: active.id, kind: "SALES_ORDER", date: input.quoteDate, supplied: input.reference, auto: input.autoReference === "true" });
  const raw = linesFrom(formData); const customer = await db.customer.findFirst({ where: { id: input.customerId, tenantId: active.id, isActive: true } }); if (!customer) throw new Error("Select an active customer belonging to this company.");
  const itemIds = [...new Set(raw.flatMap((line) => line.itemId ? [line.itemId] : []))]; const items = await db.inventoryItem.findMany({ where: { tenantId: active.id, id: { in: itemIds }, isActive: true } }); if (items.length !== itemIds.length) throw new Error("Every inventory item must be active and belong to this company.");
  if (raw.some((line) => line.itemId && !line.locationId)) throw new Error("Select a stock location for every inventory order line.");
  const locationIds = [...new Set(raw.flatMap((line) => line.locationId ? [line.locationId] : []))]; if (await db.inventoryLocation.count({ where: { tenantId: active.id, id: { in: locationIds }, isActive: true } }) !== locationIds.length) throw new Error("Every stock location must be active and belong to this company.");
  const lines = raw.map((line) => ({ ...line, accountId: line.itemId ? items.find((item) => item.id === line.itemId)!.revenueAccountId : line.accountId })); const accountIds = [...new Set(lines.map((line) => line.accountId))]; if (await db.account.count({ where: { tenantId: active.id, id: { in: accountIds }, type: "REVENUE", isActive: true } }) !== accountIds.length) throw new Error("Every order line must use an active revenue account.");
  let rate = new Prisma.Decimal(1); if (customer.currencyCode !== active.defaultCurrency) { const exchange = await db.exchangeRate.findFirst({ where: { tenantId: active.id, currencyCode: customer.currencyCode, effectiveOn: { lte: input.quoteDate } }, orderBy: { effectiveOn: "desc" } }); if (!exchange) throw new Error(`No ${customer.currencyCode} exchange rate exists on or before the order date.`); rate = exchange.rateToBase; }
  const foreignTotal = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
  const order = await db.salesOrder.create({ data: { tenantId: active.id, customerId: customer.id, reference, orderDate: input.quoteDate, expectedDate: input.validUntil, description: input.description, currency: customer.currencyCode, exchangeRate: rate, foreignTotal, baseTotal: convertForeignToBase(foreignTotal, rate), createdById: user.id, lines: { create: lines.map((line) => ({ revenueAccountId: line.accountId, inventoryItemId: line.itemId, inventoryLocationId: line.itemId ? line.locationId : null, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent, discountAmount: line.discountAmount, lineTotal: line.lineTotal })) } } });
  await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_ORDER_CREATED", entityType: "SalesOrder", entityId: order.id, newValues: { reference, status: "DRAFT", total: foreignTotal.toString() } } }); redirect(`/sales/orders/${order.id}`);
}

export async function convertQuotationToSalesOrder(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole); const quotationId = z.string().cuid().parse(formData.get("id")); const orderDate = z.coerce.date().parse(formData.get("orderDate")); const expectedDate = z.coerce.date().parse(formData.get("expectedDate")); if (expectedDate < orderDate) throw new Error("Expected fulfillment date cannot be before the order date.");
  const claimed = await db.salesQuotation.updateMany({ where: { id: quotationId, tenantId: active.id, status: "ACCEPTED", convertedInvoice: null, convertedOrder: null }, data: { status: "CONVERTED", convertedAt: new Date() } }); if (claimed.count !== 1) throw new Error("Only an accepted, unconverted quotation can become a sales order.");
  let orderId: string;
  try { const quotation = await db.salesQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: { lines: true } }); const reference = await resolveReference({ tenantId: active.id, kind: "SALES_ORDER", date: orderDate, auto: true }); const order = await db.salesOrder.create({ data: { tenantId: active.id, customerId: quotation.customerId, quotationId, reference, orderDate, expectedDate, description: quotation.description, currency: quotation.currency, exchangeRate: quotation.exchangeRate, foreignTotal: quotation.foreignTotal, baseTotal: quotation.baseTotal, status: "DRAFT", createdById: user.id, lines: { create: quotation.lines.map((line) => ({ revenueAccountId: line.revenueAccountId, inventoryItemId: line.inventoryItemId, inventoryLocationId: line.inventoryLocationId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent, discountAmount: line.discountAmount, lineTotal: line.lineTotal })) } } }); orderId = order.id; await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_QUOTATION_CONVERTED_TO_ORDER", entityType: "SalesOrder", entityId: order.id, newValues: { quotationId, reference } } }); }
  catch (error) { await db.salesQuotation.updateMany({ where: { id: quotationId, tenantId: active.id, status: "CONVERTED", convertedOrder: null, convertedInvoice: null }, data: { status: "ACCEPTED", convertedAt: null } }); throw error; }
  redirect(`/sales/orders/${orderId}`);
}

export async function changeSalesOrderStatus(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole); const id = z.string().cuid().parse(formData.get("id")); const status = z.nativeEnum(SalesOrderStatus).parse(formData.get("status")); const order = await db.salesOrder.findFirst({ where: { id, tenantId: active.id } }); if (!order) throw new Error("Sales order not found."); assertSalesOrderTransition(order.status, status); const now = new Date(); await db.salesOrder.update({ where: { id }, data: { status, confirmedAt: status === "CONFIRMED" ? now : undefined, readyAt: status === "READY_TO_INVOICE" ? now : undefined } }); await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_ORDER_STATUS_CHANGED", entityType: "SalesOrder", entityId: id, previousValues: { status: order.status }, newValues: { status } } }); revalidatePath("/sales/orders"); revalidatePath(`/sales/orders/${id}`);
}

export async function convertSalesOrderToInvoice(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole); const id = z.string().cuid().parse(formData.get("id")); const invoiceDate = z.coerce.date().parse(formData.get("invoiceDate")); const dueDate = z.coerce.date().parse(formData.get("dueDate")); if (dueDate < invoiceDate) throw new Error("Invoice due date cannot be before the invoice date."); const claimed = await db.salesOrder.updateMany({ where: { id, tenantId: active.id, status: "READY_TO_INVOICE", convertedInvoice: null }, data: { status: "CONVERTED", convertedAt: new Date() } }); if (claimed.count !== 1) throw new Error("Only a ready, unconverted sales order can be invoiced."); let invoiceId: string;
  try { const order = await db.salesOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } }); const reference = await resolveReference({ tenantId: active.id, kind: "SALES_INVOICE", date: invoiceDate, auto: true }); const invoice = await postCommercialDocument({ kind: "SALE", actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, partyId: order.customerId, reference, documentDate: invoiceDate, dueDate, description: order.description || `Converted from sales order ${order.reference}`, lines: order.lines.map((line) => ({ description: line.description, accountId: line.revenueAccountId, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), discountPercent: line.discountPercent.toString(), itemId: line.inventoryItemId || undefined, locationId: line.inventoryLocationId || undefined })) }); await db.salesInvoice.update({ where: { id: invoice.id }, data: { salesOrderId: id } }); invoiceId = invoice.id; await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_ORDER_CONVERTED_TO_INVOICE", entityType: "SalesOrder", entityId: id, newValues: { invoiceId, invoiceReference: reference } } }); }
  catch (error) { await db.salesOrder.updateMany({ where: { id, tenantId: active.id, status: "CONVERTED", convertedInvoice: null }, data: { status: "READY_TO_INVOICE", convertedAt: null } }); throw error; }
  redirect(`/sales/${invoiceId}/edit`);
}

export async function deleteSalesOrder(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole); const input = z.object({ id: z.string().cuid(), reason: z.string().trim().min(5).max(240) }).parse(Object.fromEntries(formData)); const order = await db.salesOrder.findFirst({ where: { id: input.id, tenantId: active.id, status: { in: ["DRAFT", "CANCELLED"] } } }); if (!order) throw new Error("Only draft or cancelled sales orders can be deleted."); await db.$transaction([db.salesOrder.delete({ where: { id: order.id } }), db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_ORDER_DELETED", entityType: "SalesOrder", entityId: order.id, previousValues: { reference: order.reference, status: order.status }, reason: input.reason } })]); redirect("/sales/orders");
}
