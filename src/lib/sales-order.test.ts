import { describe, expect, it } from "vitest";
import { assertSalesOrderTransition } from "./sales-order";

describe("sales order lifecycle", () => {
  it("supports confirmation, readiness, and one-way conversion", () => {
    expect(() => assertSalesOrderTransition("DRAFT", "CONFIRMED")).not.toThrow();
    expect(() => assertSalesOrderTransition("CONFIRMED", "READY_TO_INVOICE")).not.toThrow();
    expect(() => assertSalesOrderTransition("READY_TO_INVOICE", "CONVERTED")).not.toThrow();
  });
  it("rejects posting directly from a draft or reopening a converted order", () => {
    expect(() => assertSalesOrderTransition("DRAFT", "CONVERTED")).toThrow("cannot be changed");
    expect(() => assertSalesOrderTransition("CONVERTED", "CONFIRMED")).toThrow("cannot be changed");
  });
});
