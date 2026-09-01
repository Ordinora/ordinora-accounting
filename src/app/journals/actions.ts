"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createDraftJournal, permanentlyDeleteJournal, reverseJournal, transitionJournal, updateManualJournal } from "@/lib/journals";
import { requireActiveTenant } from "@/lib/session";
import { db } from "@/lib/db";
import { resolveReference } from "@/lib/reference-numbers";

const draftSchema = z.object({ reference: z.string().trim().max(40).default(""), autoReference:z.string().optional(), description: z.string().trim().min(3).max(240), accountingDate: z.coerce.date(), debitAccountId: z.string().min(1), creditAccountId: z.string().min(1), amount: z.string().min(1) });

export async function createJournal(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  const input = draftSchema.parse(Object.fromEntries(formData));
  const reference=await resolveReference({tenantId:active.id,kind:"MANUAL_JOURNAL",date:input.accountingDate,supplied:input.reference,auto:input.autoReference==="true"}); const period=await db.accountingPeriod.findFirst({where:{tenantId:active.id,status:"OPEN",startsOn:{lte:input.accountingDate},endsOn:{gte:input.accountingDate}},orderBy:{startsOn:"desc"}}); if(!period)throw new Error("The accounting date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose another date.");
  const journal = await createDraftJournal({ tenantId: active.id, userId: user.id, role: user.staffRole, reference, description: input.description, accountingDate: input.accountingDate, periodId: period.id, postImmediately: true, lines: [{ accountId: input.debitAccountId, debit: input.amount, credit: "", description: input.description }, { accountId: input.creditAccountId, debit: "", credit: input.amount, description: input.description }] });
  redirect(`/journals/${journal.id}`);
}

async function move(formData: FormData, target: "IN_REVIEW" | "APPROVED" | "POSTED") { const { user, active } = await requireActiveTenant(); const id = z.string().min(1).parse(formData.get("journalId")); await transitionJournal({ tenantId: active.id, userId: user.id, role: user.staffRole }, id, target); revalidatePath(`/journals/${id}`); revalidatePath("/journals"); }
export async function submitJournal(formData: FormData) { return move(formData, "IN_REVIEW"); }
export async function approveJournal(formData: FormData) { return move(formData, "APPROVED"); }
export async function postJournal(formData: FormData) { return move(formData, "POSTED"); }
export async function reversePostedJournal(formData: FormData) { const { user, active } = await requireActiveTenant(); const id = z.string().min(1).parse(formData.get("journalId")); const reason = z.string().min(5).max(240).parse(formData.get("reason")); await reverseJournal({ tenantId: active.id, userId: user.id, role: user.staffRole }, id, reason); redirect("/journals"); }
export async function deleteJournalPermanently(formData: FormData) { const { user, active } = await requireActiveTenant(); const id = z.string().min(1).parse(formData.get("journalId")); const confirmation = z.string().trim().min(1).max(80).parse(formData.get("confirmation")); const reason = z.string().trim().min(5).max(240).parse(formData.get("reason")); await permanentlyDeleteJournal({ tenantId: active.id, userId: user.id, role: user.staffRole }, id, confirmation, reason); revalidatePath("/"); revalidatePath("/journals"); revalidatePath("/purchases"); revalidatePath("/payments"); revalidatePath("/sales"); revalidatePath("/receipts"); revalidatePath("/reports"); redirect("/journals"); }
export async function editManualJournal(formData: FormData) { const { user, active } = await requireActiveTenant(); const data = z.object({ journalId: z.string().min(1), reference: z.string().trim().min(1).max(40), description: z.string().trim().min(3).max(240), accountingDate: z.coerce.date(), debitAccountId: z.string().min(1), creditAccountId: z.string().min(1), amount: z.string().min(1), reason: z.string().trim().min(5).max(240) }).parse(Object.fromEntries(formData)); await updateManualJournal({ actor: { tenantId: active.id, userId: user.id, role: user.staffRole }, ...data }); revalidatePath("/"); revalidatePath("/journals"); revalidatePath("/reports"); redirect(`/journals/${data.journalId}`); }
