"use server";
import { AccountType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { classificationsForAccountType } from "@/lib/account-classifications";
import { expectedTypeForControlRole } from "@/lib/control-accounts";
import { requireActiveTenant } from "@/lib/session";

export type AccountActionState = { error?: string };
const accountSchema = z.object({ code: z.string().trim().regex(/^\d{3,8}$/, "Use a 3–8 digit account code."), name: z.string().trim().min(2, "Account name must contain at least two characters.").max(100), type: z.nativeEnum(AccountType), reportingClassification: z.string().trim().min(2, "Enter a reporting classification.").max(100) });
function validateClassification(input: z.infer<typeof accountSchema>) { if (!classificationsForAccountType(input.type).includes(input.reportingClassification as never)) throw new Error(`Select a standard ${input.type.toLowerCase()} reporting classification.`); return input; }
function assertCanManage(role: string | null) { if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot manage the chart of accounts."); }
function message(error: unknown) { if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the account details."; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "An account with this code already exists in the current company."; return error instanceof Error ? error.message : "The account could not be saved."; }
async function duplicate(tenantId: string, code: string, name: string, excludeId?: string) { return db.account.findFirst({ where: { tenantId, ...(excludeId ? { id: { not: excludeId } } : {}), OR: [{ code }, { name: { equals: name, mode: "insensitive" } }] }, select: { code: true, name: true } }); }

export async function createAccount(_state: AccountActionState, formData: FormData): Promise<AccountActionState> {
  let accountId: string | undefined;
  try { const { user, active } = await requireActiveTenant(); assertCanManage(user.staffRole); const input = validateClassification(accountSchema.parse(Object.fromEntries(formData))); const existing = await duplicate(active.id, input.code, input.name); if (existing) return { error: existing.code === input.code ? `Account code ${input.code} already exists.` : `Account name “${input.name}” already exists.` }; accountId = await db.$transaction(async tx => { const created = await tx.account.create({ data: { tenantId: active.id, ...input } }); await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "ACCOUNT_CREATED", entityType: "Account", entityId: created.id, newValues: { code: created.code, name: created.name, type: created.type } } }); return created.id; }); }
  catch (error) { return { error: message(error) }; }
  redirect(`/accounts/${accountId}/edit`);
}

export async function updateAccount(_state: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try { const { user, active } = await requireActiveTenant(); assertCanManage(user.staffRole); const id = z.string().min(1).parse(formData.get("accountId")), input = validateClassification(accountSchema.parse(Object.fromEntries(formData))), isActive = formData.get("isActive") === "on"; const existing = await duplicate(active.id, input.code, input.name, id); if (existing) return { error: existing.code === input.code ? `Account code ${input.code} already exists.` : `Account name “${input.name}” already exists.` }; await db.$transaction(async tx => { const previous = await tx.account.findFirst({ where: { id, tenantId: active.id } }); if (!previous) throw new Error("Account not found."); if (previous.controlRole) { if (!isActive) throw new Error("Trade receivables and trade payables control accounts cannot be deactivated."); const expectedType = expectedTypeForControlRole(previous.controlRole); if (input.type !== expectedType) throw new Error(`A ${previous.controlRole === "TRADE_RECEIVABLES" ? "trade receivables" : "trade payables"} control account must remain an ${expectedType.toLowerCase()} account.`); } if (previous.code === "3100" && (!isActive || input.code !== "3100" || input.type !== "EQUITY")) throw new Error("Retained earnings account 3100 must remain active, keep code 3100, and remain an equity account because year-end closing depends on it."); const updated = await tx.account.update({ where: { id }, data: { ...input, isActive } }); await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: isActive ? "ACCOUNT_UPDATED" : "ACCOUNT_DEACTIVATED", entityType: "Account", entityId: id, previousValues: { code: previous.code, name: previous.name, type: previous.type, isActive: previous.isActive }, newValues: { code: updated.code, name: updated.name, type: updated.type, isActive: updated.isActive } } }); }); }
  catch (error) { return { error: message(error) }; }
  revalidatePath("/accounts"); redirect("/accounts");
}
