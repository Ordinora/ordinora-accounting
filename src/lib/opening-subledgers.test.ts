import { describe, expect, it } from "vitest";
import { openingControlPosition, outstandingSubledgerBalance, reconcileControlToSubledger } from "./opening-subledgers";

describe("opening subledger allocation", () => {
  it("shows the amount still requiring customer allocation", () => {
    const result = openingControlPosition({ target: "71388.54", allocated: "51388.54" });
    expect(result.remaining.toString()).toBe("20000");
    expect(result.complete).toBe(false);
  });

  it("marks an exactly allocated control balance complete", () => {
    expect(openingControlPosition({ target: 1000, allocated: 1000 }).complete).toBe(true);
  });

  it("reconciles document carrying values after credits and settlements", () => {
    const documents = [
      { baseTotal: "3500", credits: ["250"], allocations: ["1000"] },
      { baseTotal: "3000", allocations: ["500"] },
    ];
    expect(outstandingSubledgerBalance(documents).toString()).toBe("4750");
    expect(reconcileControlToSubledger({ controlBalance: "4750", documents }).reconciled).toBe(true);
  });

  it("reports an out-of-balance control account", () => {
    const result = reconcileControlToSubledger({ controlBalance: "4800", documents: [{ baseTotal: "4750" }] });
    expect(result.reconciled).toBe(false);
    expect(result.difference.toString()).toBe("50");
  });

  it("accepts only immaterial rounding within one cent", () => {
    expect(reconcileControlToSubledger({ controlBalance: "100.00", documents: [{ baseTotal: "99.995" }] }).reconciled).toBe(true);
    expect(reconcileControlToSubledger({ controlBalance: "100.00", documents: [{ baseTotal: "99.98" }] }).reconciled).toBe(false);
  });
});
