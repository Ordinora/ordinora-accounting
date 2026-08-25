import "server-only";
import { Prisma, StaffRole } from "@prisma/client";
import { db } from "./db";
import { calculateSpk } from "./spk";

type PayrollActor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
type PayrollLineInput = {
  employeeId: string;
  basicPay: string;
  overtime: string;
  allowances: string;
  bonuses: string;
  otherDeductions: string;
};

const zero = new Prisma.Decimal(0);

function authorize(role: StaffRole | null) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT", "PAYROLL_OFFICER"].includes(role)) {
    throw new Error("Your role cannot manage payroll runs.");
  }
}

function amount(value: string, label: string) {
  let parsed: Prisma.Decimal;
  try {
    parsed = new Prisma.Decimal(value || "0");
  } catch {
    throw new Error(`${label} must be a valid amount.`);
  }
  if (parsed.isNegative() || parsed.decimalPlaces() > 2) {
    throw new Error(`${label} cannot be negative and may have no more than two decimal places.`);
  }
  return parsed;
}

export async function preparePayrollRun(input: {
  actor: PayrollActor;
  reference: string;
  payDate: Date;
  lines: PayrollLineInput[];
}) {
  authorize(input.actor.role);
  if (!input.lines.length) throw new Error("A payroll run requires at least one employee.");

  return db.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findFirst({
      where: { tenantId: input.actor.tenantId, status: "OPEN", startsOn: { lte: input.payDate }, endsOn: { gte: input.payDate } },
      orderBy: { startsOn: "desc" },
    });
    if (!period) {
      throw new Error("The payroll pay date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose another date.");
    }

    const employeeIds = [...new Set(input.lines.map((line) => line.employeeId))];
    if (employeeIds.length !== input.lines.length) throw new Error("Each employee can appear only once.");
    const employees = await tx.employee.findMany({
      where: { tenantId: input.actor.tenantId, id: { in: employeeIds }, status: "ACTIVE", employmentStart: { lte: input.payDate }, OR: [{ employmentEnd: null }, { employmentEnd: { gte: input.payDate } }] },
    });
    if (employees.length !== employeeIds.length) {
      throw new Error("Every payroll employee must belong to this client and be actively employed on the pay date.");
    }

    const bands = await tx.spkRateBand.findMany({
      where: {
        tenantId: input.actor.tenantId,
        effectiveFrom: { lte: input.payDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.payDate } }],
      },
      orderBy: { salaryFrom: "asc" },
    });

    const entries = input.lines.map((line) => {
      const employee = employees.find((item) => item.id === line.employeeId)!;
      const basicPay = amount(line.basicPay, "Basic pay");
      const overtime = amount(line.overtime, "Overtime");
      const allowances = amount(line.allowances, "Allowances");
      const bonuses = amount(line.bonuses, "Bonuses");
      const otherDeductions = amount(line.otherDeductions, "Other deductions");
      const grossPay = basicPay.add(overtime).add(allowances).add(bonuses);
      if (grossPay.lte(0)) throw new Error(`Gross pay for ${employee.fullName} must be greater than zero.`);

      const spk = employee.schemeEligible
        ? calculateSpk(basicPay, bands)
        : { employee: zero, employer: zero };
      const netPay = grossPay.sub(spk.employee).sub(otherDeductions);
      if (netPay.isNegative()) throw new Error(`Deductions exceed gross pay for ${employee.fullName}.`);

      return {
        employeeId: employee.id,
        basicPay,
        overtime,
        allowances,
        bonuses,
        otherDeductions,
        employeeSpk: spk.employee,
        employerSpk: spk.employer,
        grossPay,
        netPay,
      };
    });

    const run = await tx.payrollRun.create({
      data: {
        tenantId: input.actor.tenantId,
        periodId: period.id,
        reference: input.reference,
        payDate: input.payDate,
        createdById: input.actor.userId,
        entries: { create: entries },
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId: input.actor.firmId,
        tenantId: input.actor.tenantId,
        actorId: input.actor.userId,
        actorKind: "STAFF",
        action: "PAYROLL_RUN_PREPARED",
        entityType: "PayrollRun",
        entityId: run.id,
        newValues: { reference: run.reference, employeeCount: entries.length, payDate: input.payDate.toISOString() },
      },
    });
    return run;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function approvePayrollRun(actor: PayrollActor, runId: string) {
  authorize(actor.role);
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, tenantId: actor.tenantId, status: "DRAFT" },
      include: { entries: true },
    });
    if (!run || !run.entries.length) throw new Error("Only a complete draft payroll run can be approved.");
    const updated = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "APPROVED", approvedById: actor.userId },
    });
    await tx.auditEvent.create({
      data: { firmId: actor.firmId, tenantId: actor.tenantId, actorId: actor.userId, actorKind: "STAFF", action: "PAYROLL_RUN_APPROVED", entityType: "PayrollRun", entityId: run.id },
    });
    return updated;
  });
}

export async function postPayrollRun(actor: PayrollActor, runId: string) {
  authorize(actor.role);
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, tenantId: actor.tenantId, status: "APPROVED" },
      include: { period: true, entries: true },
    });
    if (!run) throw new Error("Only an approved payroll run can be posted.");
    if (run.period.status !== "OPEN") throw new Error("Payroll cannot be posted into a closed or locked period.");

    const accounts = await tx.account.findMany({
      where: { tenantId: actor.tenantId, code: { in: ["6000", "6010", "2200", "2210", "2220"] }, isActive: true },
    });
    const account = (code: string) => {
      const result = accounts.find((item) => item.code === code);
      if (!result) throw new Error(`Required payroll account ${code} is missing or inactive.`);
      return result;
    };

    const totals = run.entries.reduce(
      (sum, entry) => ({
        gross: sum.gross.add(entry.grossPay),
        employeeSpk: sum.employeeSpk.add(entry.employeeSpk),
        employerSpk: sum.employerSpk.add(entry.employerSpk),
        deductions: sum.deductions.add(entry.otherDeductions),
        net: sum.net.add(entry.netPay),
      }),
      { gross: zero, employeeSpk: zero, employerSpk: zero, deductions: zero, net: zero },
    );

    const journal = await tx.journal.create({
      data: {
        tenantId: actor.tenantId,
        periodId: run.periodId,
        reference: run.reference,
        description: `Payroll — ${run.reference}`,
        accountingDate: run.payDate,
        status: "POSTED",
        source: "PAYROLL",
        sourceId: run.id,
        createdById: run.createdById,
        approvedById: run.approvedById ?? actor.userId,
        postedById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: account("6000").id, description: "Gross salaries and wages", debit: totals.gross, credit: zero },
            { accountId: account("6010").id, description: "Employer SPK contributions", debit: totals.employerSpk, credit: zero },
            { accountId: account("2210").id, description: "Net payroll payable", debit: zero, credit: totals.net },
            { accountId: account("2220").id, description: "Employee and employer SPK payable", debit: zero, credit: totals.employeeSpk.add(totals.employerSpk) },
            ...(totals.deductions.gt(0)
              ? [{ accountId: account("2200").id, description: "Other payroll deductions payable", debit: zero, credit: totals.deductions }]
              : []),
          ],
        },
      },
    });

    const updated = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "POSTED", postedAt: new Date(), journalId: journal.id },
    });
    await tx.auditEvent.create({
      data: {
        firmId: actor.firmId,
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorKind: "STAFF",
        action: "PAYROLL_RUN_POSTED",
        entityType: "PayrollRun",
        entityId: run.id,
        newValues: { journalId: journal.id, grossPay: totals.gross.toString(), netPay: totals.net.toString(), employerSpk: totals.employerSpk.toString() },
      },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateDraftPayrollInputs(actor:PayrollActor,runId:string,lines:PayrollLineInput[]){authorize(actor.role);return db.$transaction(async tx=>{const run=await tx.payrollRun.findFirst({where:{id:runId,tenantId:actor.tenantId,status:"DRAFT"},include:{entries:{include:{employee:true}}}});if(!run)throw new Error("Only a draft payroll run can be recalculated.");const ids=[...new Set(lines.map(line=>line.employeeId))];if(ids.length!==lines.length||ids.length!==run.entries.length||run.entries.some(entry=>!ids.includes(entry.employeeId)))throw new Error("Payroll employees cannot be added or removed during recalculation.");const bands=await tx.spkRateBand.findMany({where:{tenantId:actor.tenantId,effectiveFrom:{lte:run.payDate},OR:[{effectiveTo:null},{effectiveTo:{gte:run.payDate}}]},orderBy:{salaryFrom:"asc"}});for(const line of lines){const existing=run.entries.find(entry=>entry.employeeId===line.employeeId)!;const basicPay=amount(line.basicPay,"Basic pay"),overtime=amount(line.overtime,"Overtime"),allowances=amount(line.allowances,"Allowances"),bonuses=amount(line.bonuses,"Bonuses"),otherDeductions=amount(line.otherDeductions,"Other deductions"),grossPay=basicPay.add(overtime).add(allowances).add(bonuses),spk=existing.employee.schemeEligible?calculateSpk(basicPay,bands):{employee:zero,employer:zero},netPay=grossPay.sub(spk.employee).sub(otherDeductions);if(grossPay.lte(0))throw new Error(`Gross pay for ${existing.employee.fullName} must be greater than zero.`);if(netPay.isNegative())throw new Error(`Deductions exceed gross pay for ${existing.employee.fullName}.`);await tx.payrollEntry.update({where:{id:existing.id},data:{basicPay,overtime,allowances,bonuses,otherDeductions,employeeSpk:spk.employee,employerSpk:spk.employer,grossPay,netPay}})}await tx.auditEvent.create({data:{firmId:actor.firmId,tenantId:actor.tenantId,actorId:actor.userId,actorKind:"STAFF",action:"PAYROLL_INPUTS_RECALCULATED",entityType:"PayrollRun",entityId:run.id,newValues:{employeeCount:lines.length}}});return run},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})}

