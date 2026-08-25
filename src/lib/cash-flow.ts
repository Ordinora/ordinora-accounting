import { Prisma } from "@prisma/client";

export type CashFlowActivity = "OPERATING" | "INVESTING" | "FINANCING";
const zero = new Prisma.Decimal(0);
const isCash = (account: { type: string; reportingClassification: string }) => account.type === "ASSET" && account.reportingClassification === "Cash and cash equivalents";

export function classifyCashCounterpart(account: { code: string; type: string; reportingClassification: string }): CashFlowActivity {
  const classification = account.reportingClassification.toLowerCase();
  const workingCapitalControl = ["1200", "2000", "2100", "2210"].includes(account.code);
  if (account.type === "EQUITY") return "FINANCING";
  if (account.type === "LIABILITY" && !classification.includes("payable") && !workingCapitalControl) return "FINANCING";
  if (account.type === "ASSET" && !workingCapitalControl && !classification.includes("receivable") && !classification.includes("inventory") && !classification.includes("prepayment")) return "INVESTING";
  return "OPERATING";
}

export type CashFlowCounterpartLine = {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  account: { code: string; type: string; reportingClassification: string };
};

export function allocateCashFlowByActivity(lines: CashFlowCounterpartLine[]) {
  const allocated: Record<CashFlowActivity, Prisma.Decimal> = { OPERATING: zero, INVESTING: zero, FINANCING: zero };
  for (const line of lines) {
    const activity = classifyCashCounterpart(line.account);
    allocated[activity] = allocated[activity].add(line.credit).sub(line.debit);
  }
  return allocated;
}

export async function cashFlowStatement(tenantId: string, from: Date, to: Date) {
  const { db } = await import("./db");
  const journals = await db.journal.findMany({
    where: { tenantId, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { gte: from, lte: to } },
    include: { lines: { include: { account: true } } },
    orderBy: [{ accountingDate: "asc" }, { reference: "asc" }],
  });
  const openingLines = await db.journalLine.findMany({
    where: { journal: { tenantId, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { lt: from } }, account: { type: "ASSET", reportingClassification: "Cash and cash equivalents" } },
  });
  const cashBeforePeriod = openingLines.reduce((sum, line) => sum.add(line.debit).sub(line.credit), zero);
  const conversionCash = journals
    .filter(journal => journal.source === "OPENING_BALANCE")
    .flatMap(journal => journal.lines)
    .filter(line => isCash(line.account))
    .reduce((sum, line) => sum.add(line.debit).sub(line.credit), zero);
  const openingCash = cashBeforePeriod.add(conversionCash);
  const rows: { id: string; date: Date; reference: string; description: string; activity: CashFlowActivity; amount: Prisma.Decimal }[] = [];
  for (const journal of journals) {
    if (journal.source === "OPENING_BALANCE") continue;
    const cashAmount = journal.lines.filter(line => isCash(line.account)).reduce((sum, line) => sum.add(line.debit).sub(line.credit), zero);
    if (cashAmount.eq(0)) continue;
    const counterparts = journal.lines.filter(line => !isCash(line.account));
    const allocated = allocateCashFlowByActivity(counterparts);
    for (const activity of ["OPERATING", "INVESTING", "FINANCING"] as const) {
      const amount = allocated[activity];
      if (amount.eq(0)) continue;
      rows.push({ id: journal.id, date: journal.accountingDate, reference: journal.reference, description: journal.description, activity, amount });
    }
  }
  const total = (activity: CashFlowActivity) => rows.filter(row => row.activity === activity).reduce((sum, row) => sum.add(row.amount), zero);
  const operating = total("OPERATING"), investing = total("INVESTING"), financing = total("FINANCING"), netChange = operating.add(investing).add(financing), closingCash = openingCash.add(netChange);
  return { rows, openingCash, operating, investing, financing, netChange, closingCash };
}
