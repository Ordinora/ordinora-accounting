import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReportPdf } from "@/lib/report-pdf";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  const { active } = await requireActiveTenant();
  const entry = await db.payrollEntry.findFirst({
    where: {
      id: entryId,
      payrollRunId: id,
      payrollRun: { tenantId: active.id, status: { in: ["POSTED", "LOCKED"] } },
    },
    include: { employee: true, payrollRun: { include: { period: true } } },
  });

  if (!entry) return new Response("Payslip not found", { status: 404 });

  const amount = (value: Prisma.Decimal.Value) =>
    `${active.defaultCurrency} ${Number(value).toLocaleString("en-BN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const isFinalPay = entry.payrollRun.runType === "FINAL_PAY";
  const title = isFinalPay ? "Final payslip" : "Payslip";
  const gross = new Prisma.Decimal(entry.basicPay)
    .add(entry.overtime)
    .add(entry.allowances)
    .add(entry.bonuses)
    .add(entry.leavePayout)
    .add(entry.gratuity)
    .add(entry.otherEarnings);
  const deductions = new Prisma.Decimal(entry.employeeSpk).add(entry.otherDeductions);
  const earningsRows = [
    { label: "Basic pay", amount: amount(entry.basicPay) },
    { label: "Overtime", amount: amount(entry.overtime) },
    { label: "Allowances", amount: amount(entry.allowances) },
    { label: "Bonuses", amount: amount(entry.bonuses) },
    ...(isFinalPay
      ? [
          { label: "Unused leave payout", amount: amount(entry.leavePayout) },
          { label: "Gratuity / severance", amount: amount(entry.gratuity) },
          { label: "Other earnings", amount: amount(entry.otherEarnings) },
        ]
      : []),
    { label: "Gross pay", amount: amount(gross), strong: true },
  ];
  const pdf = generateReportPdf({
    company: active.legalName,
    title,
    subtitle: `${entry.employee.fullName} | ${entry.employee.employeeNumber} | ${entry.payrollRun.period.name} | Pay date ${entry.payrollRun.payDate.toLocaleDateString("en-GB")}`,
    sections: [
      { title: "Earnings", rows: earningsRows },
      {
        title: "Deductions and contributions",
        rows: [
          { label: "Employee SPK", amount: amount(entry.employeeSpk) },
          { label: "Other deductions", amount: amount(entry.otherDeductions) },
          { label: "Total employee deductions", amount: amount(deductions), strong: true },
          { label: "Employer SPK contribution", amount: amount(entry.employerSpk) },
        ],
      },
      {
        title: "Net payment",
        rows: [{ label: "Net pay", amount: amount(entry.netPay), strong: true }],
      },
    ],
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${isFinalPay ? "final-pay" : "payslip"}-${entry.employee.employeeNumber}-${entry.payrollRun.payDate.toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
