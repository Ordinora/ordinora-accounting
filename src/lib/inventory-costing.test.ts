import { describe, expect, it } from "vitest";
import { consumeFifoToPhysicalClosing, consumeToPhysicalClosing, issueAtFifo, issueAtWeightedAverage, receiveAtWeightedAverage } from "./inventory-costing";

describe("perpetual weighted-average inventory costing", () => {
  it("recalculates average cost after a differently priced purchase", () => {
    const result = receiveAtWeightedAverage({ currentQuantity: 100, currentValue: 200, receivedQuantity: 50, receivedValue: 175 });
    expect(result.newQuantity.toString()).toBe("150");
    expect(result.newValue.toString()).toBe("375");
    expect(result.averageUnitCost.toString()).toBe("2.5");
  });

  it("issues partial stock at weighted-average cost", () => {
    const result = issueAtWeightedAverage({ currentQuantity: 150, currentValue: 375, issuedQuantity: 40 });
    expect(result.issuedValue.toString()).toBe("100");
    expect(result.newQuantity.toString()).toBe("110");
    expect(result.newValue.toString()).toBe("275");
  });

  it("clears residual value when all remaining stock is issued", () => {
    const result = issueAtWeightedAverage({ currentQuantity: 3, currentValue: "10.00", issuedQuantity: 3 });
    expect(result.newQuantity.toString()).toBe("0");
    expect(result.newValue.toString()).toBe("0");
    expect(result.issuedValue.toString()).toBe("10");
  });

  it("rounds a stock issue to currency precision", () => {
    const result = issueAtWeightedAverage({ currentQuantity: 3, currentValue: 10, issuedQuantity: 1 });
    expect(result.averageUnitCost.toString()).toBe("3.3333");
    expect(result.issuedValue.toString()).toBe("3.33");
    expect(result.newValue.toString()).toBe("6.67");
  });

  it("calculates monthly consumption from a physical closing count", () => {
    const result = consumeToPhysicalClosing({ currentQuantity: 100, currentValue: 250, closingQuantity: 35 });
    expect(result.consumedQuantity.toString()).toBe("65");
    expect(result.consumedValue.toString()).toBe("162.5");
    expect(result.newQuantity.toString()).toBe("35");
    expect(result.newValue.toString()).toBe("87.5");
  });

  it("rejects issues and closing counts that would create negative stock", () => {
    expect(() => issueAtWeightedAverage({ currentQuantity: 5, currentValue: 20, issuedQuantity: 6 })).toThrow("Insufficient stock");
    expect(() => consumeToPhysicalClosing({ currentQuantity: 5, currentValue: 20, closingQuantity: 6 })).toThrow("exceeds book stock");
  });
});

describe("FIFO inventory costing", () => {
  const layers = [
    { id: "opening", quantity: 100, unitCost: 2 },
    { id: "purchase-1", quantity: 50, unitCost: "3.50" },
  ];

  it("issues the oldest layer first", () => {
    const result = issueAtFifo({ layers, issuedQuantity: 120 });
    expect(result.issuedValue.toString()).toBe("270");
    expect(result.effectiveUnitCost.toString()).toBe("2.25");
    expect(result.consumptions.map((x) => [x.id, x.quantity.toString()])).toEqual([["opening", "100"], ["purchase-1", "20"]]);
    expect(result.remainingLayers.map((x) => [x.id, x.quantity.toString(), x.unitCost.toString()])).toEqual([["purchase-1", "30", "3.5"]]);
    expect(result.remainingValue.toString()).toBe("105");
  });

  it("calculates physical-count consumption using FIFO", () => {
    const result = consumeFifoToPhysicalClosing({ layers, closingQuantity: 40 });
    expect(result.consumedQuantity.toString()).toBe("110");
    expect(result.consumedValue.toString()).toBe("235");
    expect(result.remainingValue.toString()).toBe("140");
  });

  it("rejects negative stock", () => {
    expect(() => issueAtFifo({ layers, issuedQuantity: 151 })).toThrow("Insufficient stock");
  });
});
