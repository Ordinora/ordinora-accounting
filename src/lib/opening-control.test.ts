import { AccountControlRole, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { openingControlBalance } from "./opening-control";

const line = (code: string, name: string, debit: number, credit: number, controlRole: AccountControlRole | null = null) => ({ account: { code, name, controlRole }, debit: new Prisma.Decimal(debit), credit: new Prisma.Decimal(credit) });

describe("opening control account detection", () => {
  it("recognizes the designated trade-payables control account", () => {
    expect(openingControlBalance([line("2000", "Trade payables", 0, 6500, AccountControlRole.TRADE_PAYABLES)], "PAYABLE").toString()).toBe("6500");
  });
  it("uses only the designated payable control account", () => {
    expect(openingControlBalance([line("2000", "Trade payables", 0, 3500, AccountControlRole.TRADE_PAYABLES), line("2100", "Legacy payables", 0, 3000), line("2300", "Bank loan", 0, 20000)], "PAYABLE").toString()).toBe("3500");
  });
  it("recognizes the designated trade-receivables control account", () => {
    expect(openingControlBalance([line("1200", "Accounts receivable", 7100, 0, AccountControlRole.TRADE_RECEIVABLES)], "RECEIVABLE").toString()).toBe("7100");
  });
});
