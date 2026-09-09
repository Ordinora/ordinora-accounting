import { describe, expect, it } from "vitest";
import { bruneiChart } from "../../prisma/brunei-chart";

describe("default Brunei chart of accounts", () => {
  it("calculates current earnings from revenue and expenses instead of seeding a posting account", () => {
    const codes = bruneiChart.map(([code]) => code);
    expect(codes).not.toContain("3200");
    expect(codes).toContain("3100");
    expect(codes).toContain("4000");
    expect(codes).toContain("5000");
  });

  it("contains no duplicate account codes", () => {
    const codes = bruneiChart.map(([code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("keeps salary indirect and wages direct", () => {
    const accounts = new Map(bruneiChart.map(([code, name, type, classification]) => [code, { name, type, classification }]));

    expect(accounts.get("6000")).toEqual({
      name: "Salary",
      type: "EXPENSE",
      classification: "Indirect Expenses",
    });
    expect(accounts.get("5100")).toEqual({
      name: "Wages",
      type: "EXPENSE",
      classification: "Direct Expenses",
    });
  });

  it("marks system-managed subledger accounts as controls", () => {
    const controls = new Map(bruneiChart.map(([code, , , , isControlAccount]) => [code, Boolean(isControlAccount)]));
    expect(controls.get("1200")).toBe(true);
    expect(controls.get("1300")).toBe(true);
    expect(controls.get("1510")).toBe(true);
    expect(controls.get("2000")).toBe(true);
    expect(controls.get("2210")).toBe(true);
    expect(controls.get("2220")).toBe(true);
    expect(controls.get("2230")).toBe(true);
    expect(controls.get("1500")).toBe(false);
  });
});
