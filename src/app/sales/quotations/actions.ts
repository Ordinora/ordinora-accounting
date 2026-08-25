"use server";

import { Prisma, SalesQuotationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { postCommercialDocument } from "@/lib/commercial";
import { convertForeignToBase } from "@/lib/currency";
import { db } from "@/lib/db";
import { resolveReference } from "@/lib/reference-numbers";
import { calculateQuotationLines, assertQuotationTransition } from "@/lib/sales-quotation";
import { requireActiveTenant } from "@/lib/session";

const header = z.object({
  customerId: z.string().cuid(), reference: z.string().trim().max(60).optional(), autoReference: z.string().optional(),
  quoteDate: z.coerce.date(), validUntil: z.coerce.date(), description: z.string().trim().min(2).max(500),
});

function authorize(role: string | null | undefined) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot manage sales quotations.");
}

function formLines(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map(String);
  const accounts = formData.getAll("lineAccountId").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const prices = formData.getAll("lineUnitPrice").map(String);
  const discounts = formData.getAll("lineDiscountPercent").map(String);
  const items = formData.getAll("lineItemId").map(String);
  const locations = formData.getAll("lineLocationId").map(String);
  if (!descriptions.length || ![accounts.length, quantities.length, prices.length, discounts.length, items.length, locations.length].every((n) => n === descriptions.length)) throw new Error("Quotation lines are incomplete.");
  return calculateQuotationLines(descriptions.map((description, index) => ({ description, accountId: accounts[index], quantity: quantities[index], unitPrice: prices[index], discountPercent: discounts[index], itemId: items[index] || undefined, locationId: locations[index] || undefined })));
}

export async function createSalesQuotation(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const input = header.parse(Object.fromEntries(formData));
  if (input.validUntil < input.quoteDate) throw new Error("Valid-until date cannot be before the quotation date.");
  const reference = await resolveReference({ tenantId: active.id, kind: "SALES_QUOTATION", date: input.quoteDate, supplied: input.reference, auto: input.autoReference === "true" });
  const lines = formLines(formData);
  const customer = await db.customer.findFirst({ where: { id: input.customerId, tenantId: active.id, isActive: true } });
  if (!customer) throw new Error("Select an active customer belonging to this company.");
  const itemIds = [...new Set(lines.flatMap((line) => line.itemId ? [line.itemId] : []))];
  const items = await db.inventoryItem.findMany({ where: { tenantId: active.id, id: { in: itemIds }, isActive: true } });
  if (items.length !== itemIds.length) throw new Error("Every inventory item must be active and belong to this company.");
  if (lines.some((line) => line.itemId && !line.locationId)) throw new Error("Select a stock location for every inventory quotation line.");
  const locationIds = [...new Set(lines.flatMap((line) => line.locationId ? [line.locationId] : []))];
  if (await db.inventoryLocation.count({ where: { tenantId: active.id, id: { in: locationIds }, isActive: true } }) !== locationIds.length) throw new Error("Every stock location must be active and belong to this company.");
  const resolved = lines.map((line) => ({ ...line, accountId: line.itemId ? items.find((item) => item.id === line.itemId)!.revenueAccountId : line.accountId }));
  const accountIds = [...new Set(resolved.map((line) => line.accountId))];
  if (await db.account.count({ where: { tenantId: active.id, id: { in: accountIds }, type: "REVENUE", isActive: true } }) !== accountIds.length) throw new Error("Every quotation line must use an active revenue account.");
  let rate = new Prisma.Decimal(1);
  if (customer.currencyCode !== active.defaultCurrency) {
    const exchange = await db.exchangeRate.findFirst({ where: { tenantId: active.id, currencyCode: customer.currencyCode, effectiveOn: { lte: input.quoteDate } }, orderBy: { effectiveOn: "desc" } });
    if (!exchange) throw new Error(`No ${customer.currencyCode} exchange rate exists on or before the quotation date.`);
    rate = exchange.rateToBase;
  }
  const foreignTotal = resolved.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
  const quotation = await db.salesQuotation.create({ data: { tenantId: active.id, customerId: customer.id, reference, quoteDate: input.quoteDate, validUntil: input.validUntil, description: input.description, currency: customer.currencyCode, exchangeRate: rate, foreignTotal, baseTotal: convertForeignToBase(foreignTotal, rate), createdById: user.id, lines: { create: resolved.map((line) => ({ revenueAccountId: line.accountId, inventoryItemId: line.itemId, inventoryLocationId: line.itemId ? line.locationId : null, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent, discountAmount: line.discountAmount, lineTotal: line.lineTotal })) } } });
  await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_QUOTATION_CREATED", entityType: "SalesQuotation", entityId: quotation.id, newValues: { reference, total: foreignTotal.toString(), status: "DRAFT" } } });
  redirect(`/sales/quotations/${quotation.id}`);
}

export async function changeSalesQuotationStatus(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const id = z.string().cuid().parse(formData.get("id")); const status = z.nativeEnum(SalesQuotationStatus).parse(formData.get("status"));
  const quotation = await db.salesQuotation.findFirst({ where: { id, tenantId: active.id } }); if (!quotation) throw new Error("Sales quotation not found.");
  if (status === "ACCEPTED" && quotation.validUntil < new Date()) throw new Error("This quotation has expired and cannot be accepted.");
  assertQuotationTransition(quotation.status, status);
  const now = new Date();
  await db.salesQuotation.update({ where: { id }, data: { status, sentAt: status === "SENT" ? now : undefined, acceptedAt: status === "ACCEPTED" ? now : undefined, declinedAt: status === "DECLINED" ? now : undefined } });
  await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_QUOTATION_STATUS_CHANGED", entityType: "SalesQuotation", entityId: id, previousValues: { status: quotation.status }, newValues: { status } } });
  revalidatePath("/sales/quotations"); revalidatePath(`/sales/quotations/${id}`);
}

export async function convertSalesQuotation(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const id = z.string().cuid().parse(formData.get("id")); const invoiceDate = z.coerce.date().parse(formData.get("invoiceDate")); const dueDate = z.coerce.date().parse(formData.get("dueDate"));
  if (dueDate < invoiceDate) throw new Error("Invoice due date cannot be before the invoice date.");
  const claimed = await db.salesQuotation.updateMany({ where: { id, tenantId: active.id, status: "ACCEPTED", convertedInvoice: null }, data: { status: "CONVERTED", convertedAt: new Date() } });
  if (claimed.count !== 1) throw new Error("Only an accepted, unconverted quotation can be converted.");
  let invoiceId: string;
  try {
    const quotation = await db.salesQuotation.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    const reference = await resolveReference({ tenantId: active.id, kind: "SALES_INVOICE", date: invoiceDate, auto: true });
    const invoice = await postCommercialDocument({ kind: "SALE", actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, partyId: quotation.customerId, reference, documentDate: invoiceDate, dueDate, description: quotation.description || `Converted from quotation ${quotation.reference}`, lines: quotation.lines.map((line) => ({ description: line.description, accountId: line.revenueAccountId, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), discountPercent: line.discountPercent.toString(), itemId: line.inventoryItemId || undefined, locationId: line.inventoryLocationId || undefined })) });
    await db.salesInvoice.update({ where: { id: invoice.id }, data: { quotationId: id } });
    await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_QUOTATION_CONVERTED", entityType: "SalesQuotation", entityId: id, newValues: { invoiceId: invoice.id, invoiceReference: reference } } });
    invoiceId = invoice.id;
  } catch (error) {
    await db.salesQuotation.updateMany({ where: { id, tenantId: active.id, status: "CONVERTED", convertedInvoice: null }, data: { status: "ACCEPTED", convertedAt: null } });
    throw error;
  }
  redirect(`/sales/${invoiceId}/edit`);
}

export async function deleteSalesQuotation(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const input = z.object({ id: z.string().cuid(), reason: z.string().trim().min(5).max(240) }).parse(Object.fromEntries(formData));
  const quotation = await db.salesQuotation.findFirst({ where: { id: input.id, tenantId: active.id, status: { in: ["DRAFT", "CANCELLED"] } } });
  if (!quotation) throw new Error("Only draft or cancelled quotations can be deleted.");
  await db.$transaction([db.salesQuotation.delete({ where: { id: quotation.id } }), db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "SALES_QUOTATION_DELETED", entityType: "SalesQuotation", entityId: quotation.id, previousValues: { reference: quotation.reference, status: quotation.status }, reason: input.reason } })]);
  redirect("/sales/quotations");
}
