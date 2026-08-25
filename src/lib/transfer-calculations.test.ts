import { describe, expect, it } from "vitest";
import { calculateTransferValues } from "./transfer-calculations";
describe("inter-account transfer calculations", () => {
  it("keeps same-currency transfers balanced", () => { const result = calculateTransferValues({ sourceAmount: "500.00", sourceRate: 1, destinationAmount: "500.00", destinationRate: 1 }); expect(result.realizedFxBase.toString()).toBe("0"); });
  it("calculates the base-currency exchange difference", () => { const result = calculateTransferValues({ sourceAmount: "100.00", sourceRate: 1.35, destinationAmount: "134.00", destinationRate: 1 }); expect(result.realizedFxBase.toString()).toBe("1"); });
});
