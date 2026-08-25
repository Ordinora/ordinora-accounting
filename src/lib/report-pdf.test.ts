import { describe, expect, it } from "vitest";
import { generateReportPdf } from "./report-pdf";

describe("generateReportPdf", () => {
  it("generates a valid PDF document", () => {
    const pdf = generateReportPdf({ company: "Example Ltd", title: "Balance Sheet", subtitle: "As at 31/07/2026", sections: [{ title: "Assets", rows: [{ label: "Cash", amount: "BND 100.00" }, { label: "Total assets", amount: "BND 100.00", strong: true }] }] });
    expect(Buffer.from(pdf).subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(Buffer.from(pdf).toString()).toContain("/Type /Catalog");
  });
});
