import { AccountControlRole, Prisma } from "@prisma/client";

export type DashboardLedgerLine = { debit: Prisma.Decimal.Value; credit: Prisma.Decimal.Value; account: { code: string; type: string; reportingClassification: string; controlRole: AccountControlRole | null } };
export function calculateDashboardBalances(lines: DashboardLedgerLine[]) {
  const signed = (line: DashboardLedgerLine) => Number(line.debit) - Number(line.credit);
  const cashAndBank = lines.filter((line) => line.account.type === "ASSET" && line.account.reportingClassification === "Cash and cash equivalents").reduce((sum, line) => sum + signed(line), 0);
  const receivables = lines.filter((line) => line.account.controlRole === AccountControlRole.TRADE_RECEIVABLES).reduce((sum, line) => sum + signed(line), 0);
  const payables = Math.abs(lines.filter((line) => line.account.controlRole === AccountControlRole.TRADE_PAYABLES).reduce((sum, line) => sum + signed(line), 0));
  const revenue = lines.filter((line) => line.account.type === "REVENUE").reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
  const expenses = lines.filter((line) => line.account.type === "EXPENSE").reduce((sum, line) => sum + signed(line), 0);
  return { cashAndBank, receivables, payables, netProfit: revenue - expenses };
}
