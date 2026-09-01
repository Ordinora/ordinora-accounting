"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { calculatePaymentAmounts } from "@/lib/payment-calculations";
import { db } from "@/lib/db";
import { postDirectPayment } from "@/lib/payments";
import { resolveReference } from "@/lib/reference-numbers";
import { requireActiveTenant } from "@/lib/session";

export type DirectPaymentActionState = {
  error?: string;
  redirectTo?: string;
  duplicateWarning?: { acknowledgement: string; message: string };
};

const schema = z.object({
  bankAccountId: z.string().min(1), reference: z.string().trim().max(40).default(""), autoReference: z.string().optional(),
  paymentDate: z.coerce.date(), payee: z.string().trim().min(1).max(160), description: z.string().trim().max(500),
  currency: z.string().trim().length(3), discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]).default("NONE"),
  discountValue: z.string().trim().default("0"), paymentMethod: z.enum(["BANK_TRANSFER", "BANK_CHEQUE", "CASH", "OTHER"]),
  chequeNumber: z.string().trim().max(60).optional(), chequeDate: z.coerce.date().optional(),
});

function actionError(error: unknown): DirectPaymentActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Review the required payment details." };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "That payment reference is already in use." };
  return { error: error instanceof Error ? error.message : "The payment could not be posted. Please try again." };
}

function dateWindow(date: Date) {
  const start = new Date(date), end = new Date(date);
  start.setUTCDate(start.getUTCDate() - 30);
  end.setUTCDate(end.getUTCDate() + 30);
  return { start, end };
}

export async function createDirectPayment(_state: DirectPaymentActionState, formData: FormData): Promise<DirectPaymentActionState> {
  try {
    const { user, active } = await requireActiveTenant();
    const header = schema.parse(Object.fromEntries(formData));
    const accountIds = formData.getAll("lineAccountId").map(String), itemIds = formData.getAll("lineItemId").map(String), locationIds = formData.getAll("lineLocationId").map(String), descriptions = formData.getAll("lineDescription").map(String), quantities = formData.getAll("lineQuantity").map(String), unitPrices = formData.getAll("lineUnitPrice").map(String), discounts = formData.getAll("lineDiscountPercent").map(String);
    if (![itemIds.length, locationIds.length, descriptions.length, quantities.length, unitPrices.length, discounts.length].every((length) => length === accountIds.length)) throw new Error("Payment lines are incomplete.");
    const lines = accountIds.map((accountId, index) => ({ accountId, inventoryItemId: itemIds[index] || undefined, inventoryLocationId: locationIds[index] || undefined, description: descriptions[index], quantity: quantities[index], unitPrice: unitPrices[index], discountPercent: discounts[index] }));
    const calculated = calculatePaymentAmounts(lines, header.discountType, header.discountValue);

    const supplier = await db.supplier.findFirst({ where: { tenantId: active.id, isActive: true, OR: [{ name: { equals: header.payee, mode: "insensitive" } }, { code: { equals: header.payee, mode: "insensitive" } }] }, select: { id: true } });
    if (supplier) {
      const { start, end } = dateWindow(header.paymentDate);
      const possibleDuplicate = await db.supplierBill.findFirst({
        where: { tenantId: active.id, supplierId: supplier.id, status: { not: "VOIDED" }, currency: header.currency.toUpperCase(), foreignTotal: calculated.foreignTotal, billDate: { gte: start, lte: end } },
        orderBy: { billDate: "desc" }, select: { id: true, reference: true, billDate: true, foreignTotal: true, currency: true },
      });
      if (possibleDuplicate) {
        const acknowledgement = `${possibleDuplicate.id}:${possibleDuplicate.foreignTotal.toFixed(2)}`;
        if (formData.get("duplicateAcknowledgement") !== acknowledgement) return { duplicateWarning: { acknowledgement, message: `Possible duplicate: supplier bill ${possibleDuplicate.reference} for ${possibleDuplicate.currency} ${possibleDuplicate.foreignTotal.toFixed(2)} is dated ${possibleDuplicate.billDate.toISOString().slice(0, 10)}. If this payment settles that bill, cancel and use Pay Supplier Invoice so payables are cleared. Continue only if this is a separate direct purchase.` } };
      }
    }

    // Allocate the automatic reference only after the duplicate check so a warning does not consume a number.
    const reference = await resolveReference({ tenantId: active.id, kind: "PAYMENT", date: header.paymentDate, supplied: header.reference, auto: header.autoReference === "true" });
    await postDirectPayment({ actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, bankAccountId: header.bankAccountId, reference, paymentDate: header.paymentDate, payee: header.payee, description: header.description, currency: header.currency, discountType: header.discountType, discountValue: header.discountValue, paymentMethod: header.paymentMethod, chequeNumber: header.chequeNumber, chequeDate: header.chequeDate, lines });
    return { redirectTo: "/payments" };
  } catch (error) { return actionError(error); }
}

export async function updateDirectPayment(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot update payments.");
  const input = z.object({ id: z.string().min(1), reference: z.string().trim().min(1).max(40), payee: z.string().trim().min(1).max(160), description: z.string().trim().max(500), reason: z.string().trim().min(5).max(240) }).parse(Object.fromEntries(formData));
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: input.id, tenantId: active.id } });
    if (!payment) throw new Error("Payment not found.");
    await tx.payment.update({ where: { id: payment.id }, data: { reference: input.reference, payee: input.payee, description: input.description || null } });
    if (payment.journalId) await tx.journal.update({ where: { id: payment.journalId }, data: { reference: input.reference, description: input.description || `Payment to ${input.payee}` } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "PAYMENT_UPDATED", entityType: "Payment", entityId: payment.id, previousValues: { reference: payment.reference, payee: payment.payee, description: payment.description }, newValues: { reference: input.reference, payee: input.payee, description: input.description }, reason: input.reason } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidatePath("/payments"); revalidatePath("/journals"); revalidatePath("/reports");
  redirect("/payments");
}
