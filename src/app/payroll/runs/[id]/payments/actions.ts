"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { resolveReference } from "@/lib/reference-numbers";
import { withTransactionNotice } from "@/lib/transaction-notice";

export type PayrollPaymentState = { error?: string };

export async function postPayrollSettlement(_state: PayrollPaymentState, formData: FormData): Promise<PayrollPaymentState> {
  let runId = "";
  try {
    const { user, active } = await requireActiveTenant();
    if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT", "PAYROLL_OFFICER"].includes(user.staffRole)) throw new Error("Your role cannot pay payroll runs.");
    const input = z.object({ runId: z.string().min(1), bankAccountId: z.string().min(1), reference: z.string().trim().max(40).default(""), autoReference: z.string().optional(), paymentDate: z.coerce.date(), amount: z.coerce.number().positive(), notes: z.string().trim().max(500).optional() }).parse(Object.fromEntries(formData));
    input.reference = await resolveReference({ tenantId: active.id, kind: "PAYROLL_PAYMENT", date: input.paymentDate, supplied: input.reference, auto: input.autoReference === "true" });
    runId = input.runId;
    await db.$transaction(async tx => {
      const [run, period, bank, payable] = await Promise.all([
        tx.payrollRun.findFirst({ where: { id: input.runId, tenantId: active.id, status: { in: ["POSTED", "LOCKED"] } }, include: { entries: true, settlements: true } }),
        tx.accountingPeriod.findFirst({ where: { tenantId: active.id, status: "OPEN", startsOn: { lte: input.paymentDate }, endsOn: { gte: input.paymentDate } } }),
        tx.account.findFirst({ where: { id: input.bankAccountId, tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } }),
        tx.account.findFirst({ where: { tenantId: active.id, code: "2210", isActive: true, type: "LIABILITY" } }),
      ]);
      if (!run) throw new Error("Only a posted or locked payroll run can be paid.");
      if (!period) throw new Error("The payment date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose a date in an open period.");
      if (!bank) throw new Error("Select a valid cash or bank account.");
      if (!payable) throw new Error("Required payroll payable account 2210 is missing or inactive.");
      const net = run.entries.reduce((sum, entry) => sum.add(entry.netPay), new Prisma.Decimal(0));
      const paid = run.settlements.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP), outstanding = net.sub(paid);
      if (amount.gt(outstanding)) throw new Error(`Payment exceeds outstanding payroll of ${active.defaultCurrency} ${outstanding.toFixed(2)}.`);
      const journal = await tx.journal.create({ data: { tenantId: active.id, periodId: period.id, reference: input.reference, description: input.notes || `Payroll payment — ${run.reference}`, accountingDate: input.paymentDate, status: "POSTED", source: "PAYROLL_PAYMENT", createdById: user.id, approvedById: user.id, postedById: user.id, postedAt: new Date(), lines: { create: [{ accountId: payable.id, description: `Settle payroll payable — ${run.reference}`, debit: amount, credit: new Prisma.Decimal(0) }, { accountId: bank.id, description: `Payroll paid — ${run.reference}`, debit: new Prisma.Decimal(0), credit: amount }] } } });
      const settlement = await tx.payrollSettlement.create({ data: { tenantId: active.id, payrollRunId: run.id, periodId: period.id, bankAccountId: bank.id, reference: input.reference, paymentDate: input.paymentDate, amount, journalId: journal.id, notes: input.notes || null, createdById: user.id } });
      await tx.journal.update({ where: { id: journal.id }, data: { sourceId: settlement.id } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "PAYROLL_SETTLEMENT_POSTED", entityType: "PayrollSettlement", entityId: settlement.id, newValues: { runId: run.id, reference: input.reference, amount: amount.toString(), journalId: journal.id, periodId: period.id } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The payroll payment could not be posted." };
  }
  revalidatePath(`/payroll/runs/${runId}`);
  redirect(withTransactionNotice(`/payroll/runs/${runId}`, "payroll-payment"));
}
