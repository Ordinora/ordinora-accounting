import "server-only";

import { Prisma } from "@prisma/client";
import { ledgerBalances } from "./reports";

type LedgerBalanceRow = Awaited<ReturnType<typeof ledgerBalances>>[number];
type TrendLoader = (tenantId: string, from: Date | undefined, to: Date, options: { excludeYearEndClosing: boolean }) => Promise<LedgerBalanceRow[]>;

export type BalanceTrendPoint = {
  periodLabel: string;
  periodEnd: string;
  cash: number;
  revenue: number;
  expense: number;
  profit: number;
};

export type AgingChartPoint = { bucket: string; receivables: number; payables: number };

const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

export function trendMonthEnds(months: number, asOf = new Date()) {
  const count = Math.max(1, Math.min(12, Math.trunc(months)));
  const points: Date[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    if (offset === 0) {
      points.push(new Date(asOf));
      continue;
    }
    points.push(new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - offset + 1, 0, 23, 59, 59, 999)));
  }
  return points;
}

function summarizeSnapshot(rows: LedgerBalanceRow[]) {
  return rows.reduce((total, row) => {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    if (row.type === "ASSET" && row.classification === "Cash and cash equivalents") total.cash += debit - credit;
    if (row.type === "REVENUE") total.revenue += credit - debit;
    if (row.type === "EXPENSE") total.expense += debit - credit;
    return total;
  }, { cash: 0, revenue: 0, expense: 0 });
}

export async function buildBalanceTrend(tenantId: string, months: number, asOf: Date, load: TrendLoader): Promise<BalanceTrendPoint[]> {
  const monthEnds = trendMonthEnds(months, asOf);
  const first = monthEnds[0];
  const baseline = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 0, 23, 59, 59, 999));
  const snapshots = await Promise.all([baseline, ...monthEnds].map((date) => load(tenantId, undefined, date, { excludeYearEndClosing: true })));
  const totals = snapshots.map(summarizeSnapshot);

  return monthEnds.map((date, index) => {
    const previous = totals[index];
    const current = totals[index + 1];
    const revenue = current.revenue - previous.revenue;
    const expense = current.expense - previous.expense;
    return {
      periodLabel: monthLabel.format(date),
      periodEnd: date.toISOString(),
      cash: current.cash,
      revenue,
      expense,
      profit: revenue - expense,
    };
  });
}

export function trendPeriodEnds(from: Date, to: Date) {
  const points: Date[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  while (cursor < to) {
    points.push(cursor);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 2, 0, 23, 59, 59, 999));
  }
  points.push(new Date(to));
  return points;
}

export async function buildBalanceTrendForRange(tenantId: string, from: Date, to: Date, load: TrendLoader): Promise<BalanceTrendPoint[]> {
  const periodEnds = trendPeriodEnds(from, to);
  const baseline = new Date(from.getTime() - 1);
  const snapshots = await Promise.all([baseline, ...periodEnds].map((date) => load(tenantId, undefined, date, { excludeYearEndClosing: true })));
  const totals = snapshots.map(summarizeSnapshot);
  return periodEnds.map((date, index) => {
    const previous = totals[index];
    const current = totals[index + 1];
    const revenue = current.revenue - previous.revenue;
    const expense = current.expense - previous.expense;
    return { periodLabel: monthLabel.format(date), periodEnd: date.toISOString(), cash: current.cash, revenue, expense, profit: revenue - expense };
  });
}

export function getBalanceTrend(tenantId: string, months = 6, asOf = new Date()) {
  return buildBalanceTrend(tenantId, months, asOf, ledgerBalances);
}

export function getBalanceTrendForRange(tenantId: string, from: Date, to: Date) {
  return buildBalanceTrendForRange(tenantId, from, to, ledgerBalances);
}

const agingBuckets = ["CURRENT", "1–30", "31–60", "61–90", "90+"] as const;

export function summarizeAging(
  receivables: Array<{ bucket: string; outstanding: Prisma.Decimal.Value }>,
  payables: Array<{ bucket: string; outstanding: Prisma.Decimal.Value }>,
): AgingChartPoint[] {
  const sum = (rows: Array<{ bucket: string; outstanding: Prisma.Decimal.Value }>, bucket: string) => rows.filter((row) => row.bucket === bucket).reduce((total, row) => total + Number(row.outstanding), 0);
  return agingBuckets.map((bucket) => ({ bucket: bucket === "CURRENT" ? "Current" : bucket, receivables: sum(receivables, bucket), payables: sum(payables, bucket) }));
}
