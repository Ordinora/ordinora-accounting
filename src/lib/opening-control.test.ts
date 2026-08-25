import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { openingControlBalance } from "./opening-control";

const line = (code: string, name: string, debit: number, credit: number) => ({ account: { code, name }, debit: new Prisma.Decimal(debit), credit: new Prisma.Decimal(credit) });

describe("opening control account detection", () => {
  it("recognizes the legacy 2000 trade-payables account", () => {
    expect(openingControlBalance([line("2000", "Trade payables", 0, 6500)], "PAYABLE").toString()).toBe("6500");
  });
  it("combines supported payable-control lines without using unrelated liabilities", () => {
    expect(openingControlBalance([line("2000", "Trade payables", 0, 3500), line("2100", "Trade payables control", 0, 3000), line("2300", "Bank loan", 0, 20000)], "PAYABLE").toString()).toBe("6500");
  });
  it("recognizes trade receivables by account code", () => {
    expect(openingControlBalance([line("1200", "Accounts receivable", 7100, 0)], "RECEIVABLE").toString()).toBe("7100");
  });
});
