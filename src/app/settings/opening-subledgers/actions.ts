"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMoneyToMinor } from "@/lib/accounting";
import { db } from "@/lib/db";
import { openingControlBalance } from "@/lib/opening-control";
import { requireActiveTenant } from "@/lib/session";

export type OpeningDocumentState = { error?: string };
const schema = z.object({ kind: z.enum(["RECEIVABLE", "PAYABLE"]), partyId: z.string().min(1), reference: z.string().trim().min(1).max(60), documentDate: z.coerce.date(), dueDate: z.coerce.date(), amount: z.string().min(1), description: z.string().trim().max(500) });

export async function createOpeningDocument(_state: OpeningDocumentState, formData: FormData): Promise<OpeningDocumentState> {
  let submittedReference = "";
  try {
    const { user, active } = await requireActiveTenant();
    if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot enter opening documents.");
    const input = schema.parse(Object.fromEntries(formData)); submittedReference = input.reference;
    if (input.dueDate < input.documentDate) throw new Error("Due date cannot be before the document date.");
    const amount = new Prisma.Decimal(parseMoneyToMinor(input.amount).toString()).div(100);
    if (amount.lte(0)) throw new Error("Outstanding amount must be greater than zero.");
    await db.$transaction(async (tx) => {
      const duplicate = input.kind === "RECEIVABLE" ? await tx.salesInvoice.findFirst({ where: { tenantId: active.id, reference: input.reference }, select: { id: true } }) : await tx.supplierBill.findFirst({ where: { tenantId: active.id, reference: input.reference }, select: { id: true } });
      if (duplicate) throw new Error(`Reference ${input.reference} already exists in this company. The earlier document may already have been saved; check the list or use a different reference.`);
      const opening = await tx.journal.findFirst({ where: { tenantId: active.id, source: "OPENING_BALANCE", status: "POSTED" }, include: { lines: { include: { account: true } } }, orderBy: { accountingDate: "desc" } });
      if (!opening) throw new Error("Post the company opening balances before allocating customer or supplier balances.");
      const target = openingControlBalance(opening.lines, input.kind);
      if (target.lte(0)) throw new Error(`The opening journal has no ${input.kind === "RECEIVABLE" ? "trade-receivables" : "trade-payables"} control balance to allocate.`);
      const allocated = input.kind === "RECEIVABLE" ? await tx.salesInvoice.aggregate({ where: { tenantId: active.id, isOpeningBalance: true, status: { not: "VOIDED" } }, _sum: { baseTotal: true } }) : await tx.supplierBill.aggregate({ where: { tenantId: active.id, isOpeningBalance: true, status: { not: "VOIDED" } }, _sum: { baseTotal: true } });
      const used = allocated._sum.baseTotal ?? new Prisma.Decimal(0);
      if (used.add(amount).gt(target)) throw new Error(`This document exceeds the unallocated control balance of ${active.defaultCurrency} ${target.sub(used).toFixed(2)}.`);
      const party = input.kind === "RECEIVABLE" ? await tx.customer.findFirst({ where: { id: input.partyId, tenantId: active.id, isActive: true } }) : await tx.supplier.findFirst({ where: { id: input.partyId, tenantId: active.id, isActive: true } });
      if (!party) throw new Error("Select an active customer or supplier belonging to this company.");
      const common = { tenantId: active.id, periodId: opening.periodId, reference: input.reference, dueDate: input.dueDate, description: input.description || "Opening outstanding document", currency: active.defaultCurrency, exchangeRate: new Prisma.Decimal(1), foreignTotal: amount, baseTotal: amount, status: "POSTED" as const, journalId: null, createdById: user.id, postedAt: new Date(), isOpeningBalance: true };
      const document = input.kind === "RECEIVABLE" ? await tx.salesInvoice.create({ data: { ...common, customerId: input.partyId, invoiceDate: input.documentDate } }) : await tx.supplierBill.create({ data: { ...common, supplierId: input.partyId, billDate: input.documentDate } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: input.kind === "RECEIVABLE" ? "OPENING_RECEIVABLE_CREATED" : "OPENING_PAYABLE_CREATED", entityType: input.kind === "RECEIVABLE" ? "SalesInvoice" : "SupplierBill", entityId: document.id, newValues: { reference: input.reference, partyId: input.partyId, amount: amount.toString(), generalLedgerPosted: false } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: `Reference ${submittedReference || "entered"} already exists in this company. The earlier document may already have been saved; check the list or use a different reference.` };
    return { error: error instanceof Error ? error.message : "The opening document could not be created." };
  }
  revalidatePath("/settings/opening-subledgers"); redirect("/settings/opening-subledgers");
}

export async function deleteOpeningDocument(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot delete opening documents.");
  const kind = z.enum(["RECEIVABLE", "PAYABLE"]).parse(formData.get("kind")), id = z.string().min(1).parse(formData.get("id"));
  await db.$transaction(async (tx) => {
    if (kind === "RECEIVABLE") { const document = await tx.salesInvoice.findFirst({ where: { id, tenantId: active.id, isOpeningBalance: true }, include: { allocations: true, creditNotes: true } }); if (!document || document.allocations.length || document.creditNotes.length) throw new Error("Only an unallocated opening receivable can be deleted."); await tx.salesInvoice.delete({ where: { id } }); }
    else { const document = await tx.supplierBill.findFirst({ where: { id, tenantId: active.id, isOpeningBalance: true }, include: { allocations: true, creditNotes: true } }); if (!document || document.allocations.length || document.creditNotes.length) throw new Error("Only an unallocated opening payable can be deleted."); await tx.supplierBill.delete({ where: { id } }); }
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "OPENING_DOCUMENT_DELETED", entityType: kind, entityId: id } });
  });
  revalidatePath("/settings/opening-subledgers"); redirect("/settings/opening-subledgers");
}
