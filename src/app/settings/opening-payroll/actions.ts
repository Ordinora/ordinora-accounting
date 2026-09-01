"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertOpeningPayrollRole, openingPayrollFields, prepareOpeningPayrollYtd } from "@/lib/opening-payroll";
import { requireActiveTenant } from "@/lib/session";

export type OpeningPayrollState = { error?: string };
const amountField = z.string().trim().default("0");
const schema = z.object({
  employeeId: z.string().min(1),
  basicPay: amountField,
  overtime: amountField,
  allowances: amountField,
  bonuses: amountField,
  leavePayout: amountField,
  gratuity: amountField,
  otherEarnings: amountField,
  otherDeductions: amountField,
  employeeSpk: amountField,
  employerSpk: amountField,
});
const decimal = (minor: bigint) => new Prisma.Decimal(minor.toString()).div(100);

export async function createOpeningPayrollYtd(_state: OpeningPayrollState, formData: FormData): Promise<OpeningPayrollState> {
  try {
    const { user, active } = await requireActiveTenant();
    assertOpeningPayrollRole(user.staffRole);
    const input = schema.parse(Object.fromEntries(formData));
    await db.$transaction(async (tx) => {
      const [employee, opening, existing] = await Promise.all([
        tx.employee.findFirst({ where: { id: input.employeeId, tenantId: active.id, status: "ACTIVE" } }),
        tx.journal.findFirst({ where: { tenantId: active.id, source: "OPENING_BALANCE", status: "POSTED", description: "Opening balances at conversion date" }, orderBy: { accountingDate: "desc" } }),
        tx.openingPayrollYtd.findUnique({ where: { employeeId: input.employeeId }, select: { employeeId: true } }),
      ]);
      if (!employee) throw new Error("Select an active employee belonging to this company.");
      if (!opening) throw new Error("Post the company opening balances before entering opening payroll YTD figures.");
      const prepared = prepareOpeningPayrollYtd(input, existing ? [existing.employeeId] : []);
      const record = await tx.openingPayrollYtd.create({ data: { tenantId: active.id, employeeId: employee.id, asOfDate: opening.accountingDate, ...Object.fromEntries(openingPayrollFields.map((field) => [field, decimal(prepared.amounts[field])])), grossPay: decimal(prepared.grossPay), netPay: decimal(prepared.netPay), createdById: user.id } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "OPENING_PAYROLL_YTD_CREATED", entityType: "OpeningPayrollYtd", entityId: record.id, newValues: { employeeId: employee.id, asOfDate: opening.accountingDate.toISOString(), grossPay: record.grossPay.toString(), employeeSpk: record.employeeSpk.toString(), employerSpk: record.employerSpk.toString(), otherDeductions: record.otherDeductions.toString(), generalLedgerPosted: false } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Opening payroll YTD figures already exist for this employee." };
    return { error: error instanceof Error ? error.message : "The opening payroll YTD figures could not be saved." };
  }
  revalidatePath("/settings/opening-payroll");
  revalidatePath("/settings/opening-checklist");
  redirect("/settings/opening-payroll?success=Opening+payroll+YTD+figures+saved.");
}
