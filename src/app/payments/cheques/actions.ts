"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { markChequeCleared, returnBankCheque } from "@/lib/bank-cheques";
import { requireActiveTenant } from "@/lib/session";
import { withTransactionNotice } from "@/lib/transaction-notice";

const kindSchema = z.enum(["DIRECT", "SUPPLIER"]);
const refresh = () => ["/", "/payments", "/purchases", "/reports", "/reports/balance-sheet", "/reports/cash-flow", "/reports/payables", "/journals", "/banking/accounts"].forEach((path) => revalidatePath(path));

export async function clearCheque(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  const input = z.object({ kind: kindSchema, id: z.string().min(1), clearedOn: z.coerce.date() }).parse(Object.fromEntries(formData));
  await markChequeCleared({ tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, input.kind, input.id, input.clearedOn);
  refresh();
  redirect(withTransactionNotice("/payments", "cheque-cleared"));
}

export async function returnCheque(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  const input = z.object({ kind: kindSchema, id: z.string().min(1), returnedOn: z.coerce.date(), reason: z.string().trim().min(5).max(500), liabilityAccountId: z.string().optional() }).parse(Object.fromEntries(formData));
  await returnBankCheque({ actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, kind: input.kind, id: input.id, returnedOn: input.returnedOn, reason: input.reason, liabilityAccountId: input.liabilityAccountId });
  refresh();
  redirect(withTransactionNotice("/payments", "cheque-returned"));
}
