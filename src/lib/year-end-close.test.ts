import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { buildYearEndClosingLines, financialYearStart } from "./year-end-close";

const decimal = (value: number) => new Prisma.Decimal(value);

describe("year-end close", () => {
  it("closes revenue and expenses and transfers profit to retained earnings", () => {
    const result = buildYearEndClosingLines([
      { accountId: "revenue", code: "4000", name: "Sales", type: "REVENUE", debit: decimal(0), credit: decimal(1000) },
      { accountId: "expense", code: "6000", name: "Salaries", type: "EXPENSE", debit: decimal(400), credit: decimal(0) },
    ], "retained");

    expect(result.netIncome.toString()).toBe("600");
    expect(result.totalDebits.eq(result.totalCredits)).toBe(true);
    expect(result.lines).toEqual([
      expect.objectContaining({ accountId: "revenue", debit: decimal(1000), credit: decimal(0) }),
      expect.objectContaining({ accountId: "expense", debit: decimal(0), credit: decimal(400) }),
      expect.objectContaining({ accountId: "retained", debit: decimal(0), credit: decimal(600) }),
    ]);
  });

  it("transfers a loss as a debit to retained earnings", () => {
    const result = buildYearEndClosingLines([
      { accountId: "revenue", code: "4000", name: "Sales", type: "REVENUE", debit: decimal(0), credit: decimal(300) },
      { accountId: "expense", code: "6000", name: "Salaries", type: "EXPENSE", debit: decimal(500), credit: decimal(0) },
    ], "retained");
    const retained = result.lines.at(-1);
    expect(result.netIncome.toString()).toBe("-200");
    expect(retained?.debit.toString()).toBe("200");
    expect(retained?.credit.toString()).toBe("0");
  });

  it("calculates the start of December and June year ends", () => {
    expect(financialYearStart(new Date("2026-12-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(financialYearStart(new Date("2026-06-30T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2025-07-01");
  });
});
