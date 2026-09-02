import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { buildBalanceTrend, buildBalanceTrendForRange, summarizeAging, trendMonthEnds, trendPeriodEnds } from "./balance-trend";

const row = (type: string, classification: string, debit: number, credit: number) => ({
  id: `${type}-${classification}`,
  code: "1000",
  name: classification,
  type,
  classification,
  debit: new Prisma.Decimal(debit),
  credit: new Prisma.Decimal(credit),
  balance: new Prisma.Decimal(debit).sub(credit),
});

describe("balance trends", () => {
  it("creates a stable sequence ending at the requested as-of date", () => {
    const dates = trendMonthEnds(3, new Date("2026-03-15T12:00:00.000Z"));
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-31T23:59:59.999Z",
      "2026-02-28T23:59:59.999Z",
      "2026-03-15T12:00:00.000Z",
    ]);
  });

  it("uses month-to-month ledger changes for revenue, expense, and profit while preserving cash balances", async () => {
    const snapshots = [
      [row("ASSET", "Cash and cash equivalents", 100, 0), row("REVENUE", "Revenue", 0, 500), row("EXPENSE", "Indirect Expenses", 200, 0)],
      [row("ASSET", "Cash and cash equivalents", 150, 0), row("REVENUE", "Revenue", 0, 800), row("EXPENSE", "Indirect Expenses", 250, 0)],
      [row("ASSET", "Cash and cash equivalents", 240, 20), row("REVENUE", "Revenue", 0, 1250), row("EXPENSE", "Indirect Expenses", 400, 0)],
    ];
    const load = vi.fn().mockImplementation(async () => snapshots.shift() ?? []);
    const trend = await buildBalanceTrend("tenant-1", 2, new Date("2026-02-20T12:00:00.000Z"), load);

    expect(load).toHaveBeenCalledTimes(3);
    expect(trend).toEqual([
      expect.objectContaining({ periodLabel: "Jan 26", cash: 150, revenue: 300, expense: 50, profit: 250 }),
      expect.objectContaining({ periodLabel: "Feb 26", cash: 220, revenue: 450, expense: 150, profit: 300 }),
    ]);
  });

  it("groups existing report buckets without recomputing aging dates", () => {
    expect(summarizeAging(
      [{ bucket: "CURRENT", outstanding: "100" }, { bucket: "1–30", outstanding: "40" }],
      [{ bucket: "CURRENT", outstanding: "75" }, { bucket: "90+", outstanding: "25" }],
    )).toEqual([
      { bucket: "Current", receivables: 100, payables: 75 },
      { bucket: "1–30", receivables: 40, payables: 0 },
      { bucket: "31–60", receivables: 0, payables: 0 },
      { bucket: "61–90", receivables: 0, payables: 0 },
      { bucket: "90+", receivables: 0, payables: 25 },
    ]);
  });

  it("uses the selected From date as the trend baseline", async () => {
    const ends = trendPeriodEnds(new Date("2026-01-15T00:00:00.000Z"), new Date("2026-02-10T23:59:59.999Z"));
    expect(ends.map((date) => date.toISOString())).toEqual(["2026-01-31T23:59:59.999Z", "2026-02-10T23:59:59.999Z"]);
    const snapshots = [
      [row("REVENUE", "Revenue", 0, 100)],
      [row("REVENUE", "Revenue", 0, 250)],
      [row("REVENUE", "Revenue", 0, 400)],
    ];
    const trend = await buildBalanceTrendForRange("tenant-1", new Date("2026-01-15T00:00:00.000Z"), new Date("2026-02-10T23:59:59.999Z"), vi.fn().mockImplementation(async () => snapshots.shift() ?? []));
    expect(trend.map((point) => point.revenue)).toEqual([150, 150]);
  });
});
