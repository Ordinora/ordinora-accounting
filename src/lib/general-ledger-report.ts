import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

const zero = new Prisma.Decimal(0);

export async function generalLedgerReport(tenantId: string, from: Date, to: Date, accountId?: string) {
  const accounts = await db.account.findMany({
    where: { tenantId, ...(accountId ? { id: accountId } : {}) },
    orderBy: { code: "asc" },
    include: {
      lines: {
        where: { journal: { tenantId, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { gte: from, lte: to } } },
        include: { journal: true },
        orderBy: [{ journal: { accountingDate: "asc" } }, { journal: { createdAt: "asc" } }, { id: "asc" }],
      },
    },
  });
  const openingRows = await db.journalLine.groupBy({
    by: ["accountId"],
    where: { account: { tenantId, ...(accountId ? { id: accountId } : {}) }, journal: { tenantId, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { lt: from } } },
    _sum: { debit: true, credit: true },
  });
  const openings = new Map(openingRows.map((row) => [row.accountId, (row._sum.debit ?? zero).sub(row._sum.credit ?? zero)]));
  return accounts.map((account) => {
    const opening = openings.get(account.id) ?? zero;
    let running = opening;
    const lines = account.lines.map((line) => {
      running = running.add(line.debit).sub(line.credit);
      return { id: line.id, journalId: line.journalId, date: line.journal.accountingDate, reference: line.journal.reference, description: line.description ?? line.journal.description, source: line.journal.source, debit: line.debit, credit: line.credit, balance: running };
    });
    const debit = lines.reduce((sum, line) => sum.add(line.debit), zero);
    const credit = lines.reduce((sum, line) => sum.add(line.credit), zero);
    return { id: account.id, code: account.code, name: account.name, type: account.type, classification: account.reportingClassification, opening, debit, credit, closing: opening.add(debit).sub(credit), lines };
  }).filter((account) => !account.opening.eq(0) || !account.debit.eq(0) || !account.credit.eq(0));
}
