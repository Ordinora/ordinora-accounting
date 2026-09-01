import { describe, expect, it } from "vitest";
import { generateReportPdf } from "./report-pdf";

describe("generateReportPdf", () => {
  it("generates a valid PDF document", () => {
    const pdf = generateReportPdf({ company: "Example Ltd", title: "Balance Sheet", subtitle: "As at 31/07/2026", sections: [{ title: "Assets", rows: [{ label: "Cash", amount: "BND 100.00" }, { label: "Total assets", amount: "BND 100.00", strong: true }] }] });
    expect(Buffer.from(pdf).subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(Buffer.from(pdf).toString()).toContain("/Type /Catalog");
  });

  it("only creates another page when supplied rows overflow", () => {
    const pdf = generateReportPdf({
      company: "Seri Rasa Restaurant Sdn Bhd",
      title: "Income Statement",
      subtitle: "For the period 01/01/2026 to 26/08/2026 | Accrual accounting",
      sections: Array.from({ length: 7 }, (_, index) => ({
        title: `Section ${index + 1}`,
        rows: [{ label: "Account", amount: "BND 100.00" }, { label: `Total Section ${index + 1}`, amount: "BND 100.00", strong: true }],
      })),
    });
    const source = Buffer.from(pdf).toString("ascii");
    expect(source).toContain("/Type /Pages /Count 1");
    expect(source).toContain("Page 1 of 1");
    expect(source).not.toContain("Page 2 of");
  });

  it("encodes WinAnsi text and visibly substitutes unsupported characters", () => {
    const pdf = generateReportPdf({ company: "Café Société €", title: "Laporan 測試", subtitle: "Résumé", sections: [{ rows: [{ label: "Crème brûlée", amount: "BND 10.00" }] }] });
    const source = Buffer.from(pdf).toString("ascii");
    expect(source).toContain("/Encoding /WinAnsiEncoding");
    expect(source).toContain("Caf\\351 Soci\\351t\\351 \\200");
    expect(source).toContain("R\\351sum\\351");
    expect(source).toContain("Laporan ??");
  });
});
