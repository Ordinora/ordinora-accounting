import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const zero = new Prisma.Decimal(0);

export async function payrollEntriesForPeriod(tenantId: string, from: Date, to: Date) {
  const [entries, opening] = await Promise.all([
    db.payrollEntry.findMany({ where: { payrollRun: { tenantId, status: { in: ["POSTED", "LOCKED"] }, payDate: { gte: from, lte: to } } }, include: { employee: true, payrollRun: true }, orderBy: [{ payrollRun: { payDate: "asc" } }, { employee: { fullName: "asc" } }] }),
    db.openingPayrollYtd.findMany({ where: { tenantId, asOfDate: { gte: from, lte: to } }, include: { employee: true }, orderBy: [{ asOfDate: "asc" }, { employee: { fullName: "asc" } }] }),
  ]);
  return [
    ...entries.map((entry) => ({ ...entry, reportDate: entry.payrollRun.payDate, reportReference: entry.payrollRun.reference, reportType: entry.payrollRun.runType.replaceAll("_", " "), reportRunId: entry.payrollRun.id as string | null, isOpeningYtd: false })),
    ...opening.map((entry) => ({ ...entry, payrollRunId: null, reportDate: entry.asOfDate, reportReference: "Opening YTD", reportType: "OPENING YTD", reportRunId: null as string | null, isOpeningYtd: true })),
  ].sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime() || a.employee.fullName.localeCompare(b.employee.fullName));
}

export function payrollEntryGross(entry: {
  basicPay: Prisma.Decimal;
  overtime: Prisma.Decimal;
  allowances: Prisma.Decimal;
  bonuses: Prisma.Decimal;
  leavePayout: Prisma.Decimal;
  gratuity: Prisma.Decimal;
  otherEarnings: Prisma.Decimal;
}) {
  return zero
    .add(entry.basicPay)
    .add(entry.overtime)
    .add(entry.allowances)
    .add(entry.bonuses)
    .add(entry.leavePayout)
    .add(entry.gratuity)
    .add(entry.otherEarnings);
}

export function payrollReportTotals(entries: Awaited<ReturnType<typeof payrollEntriesForPeriod>>) {
  return entries.reduce(
    (totals, entry) => ({
      gross: totals.gross.add(payrollEntryGross(entry)),
      employeeSpk: totals.employeeSpk.add(entry.employeeSpk),
      employerSpk: totals.employerSpk.add(entry.employerSpk),
      deductions: totals.deductions.add(entry.otherDeductions),
      net: totals.net.add(entry.netPay),
    }),
    { gross: zero, employeeSpk: zero, employerSpk: zero, deductions: zero, net: zero },
  );
}

export function employeePayrollSummary(entries: Awaited<ReturnType<typeof payrollEntriesForPeriod>>) {
  const rows = new Map<string, {
    employeeId: string;
    employeeNumber: string;
    fullName: string;
    department: string | null;
    runs: number;
    gross: Prisma.Decimal;
    employeeSpk: Prisma.Decimal;
    employerSpk: Prisma.Decimal;
    deductions: Prisma.Decimal;
    net: Prisma.Decimal;
  }>();

  for (const entry of entries) {
    const current = rows.get(entry.employeeId) ?? {
      employeeId: entry.employeeId,
      employeeNumber: entry.employee.employeeNumber,
      fullName: entry.employee.fullName,
      department: entry.employee.department,
      runs: 0,
      gross: zero,
      employeeSpk: zero,
      employerSpk: zero,
      deductions: zero,
      net: zero,
    };
    current.runs += 1;
    current.gross = current.gross.add(payrollEntryGross(entry));
    current.employeeSpk = current.employeeSpk.add(entry.employeeSpk);
    current.employerSpk = current.employerSpk.add(entry.employerSpk);
    current.deductions = current.deductions.add(entry.otherDeductions);
    current.net = current.net.add(entry.netPay);
    rows.set(entry.employeeId, current);
  }

  return [...rows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function payslipItemSummary(entries: Awaited<ReturnType<typeof payrollEntriesForPeriod>>) {
  const fields = ["basicPay", "overtime", "allowances", "bonuses", "leavePayout", "gratuity", "otherEarnings", "employeeSpk", "otherDeductions", "employerSpk", "netPay"] as const;
  const rows = new Map<string, { employeeId: string; employeeNumber: string; fullName: string } & Record<(typeof fields)[number], Prisma.Decimal>>();
  for (const entry of entries) {
    const current = rows.get(entry.employeeId) ?? {
      employeeId: entry.employeeId,
      employeeNumber: entry.employee.employeeNumber,
      fullName: entry.employee.fullName,
      basicPay: zero, overtime: zero, allowances: zero, bonuses: zero,
      leavePayout: zero, gratuity: zero, otherEarnings: zero, employeeSpk: zero,
      otherDeductions: zero, employerSpk: zero, netPay: zero,
    };
    for (const field of fields) current[field] = current[field].add(entry[field]);
    rows.set(entry.employeeId, current);
  }
  return [...rows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}
