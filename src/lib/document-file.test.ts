import { describe, expect, it } from "vitest";
import { validateAccountingFile } from "./document-file";

describe("accounting document file validation", () => {
  it("accepts a PDF only when its signature, MIME type, and extension agree", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 demo\n%%EOF");
    const result = validateAccountingFile({ name: "invoice.pdf", type: "application/pdf", size: bytes.length, bytes });
    expect(result.extension).toBe(".pdf");
    expect(result.checksum).toHaveLength(64);
  });

  it("rejects an executable renamed as a PDF", () => {
    const bytes = new TextEncoder().encode("MZ executable");
    expect(() => validateAccountingFile({ name: "invoice.pdf", type: "application/pdf", size: bytes.length, bytes })).toThrow("structure");
  });

  it("rejects unsupported extensions and MIME types", () => {
    const bytes = new TextEncoder().encode("spreadsheet");
    expect(() => validateAccountingFile({ name: "statement.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: bytes.length, bytes })).toThrow("Only PDF");
  });

  it("rejects a truncated PDF even when its opening signature is valid", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 incomplete");
    expect(() => validateAccountingFile({ name: "invoice.pdf", type: "application/pdf", size: bytes.length, bytes })).toThrow("structure");
  });
});
