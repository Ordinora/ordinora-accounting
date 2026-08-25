import { describe, expect, it } from "vitest";
import { MockDocumentAIProvider } from "./mock-provider";

describe("mock document AI provider", () => {
  it("uses a user-selected classification with full confidence", async () => {
    const provider = new MockDocumentAIProvider();
    const result = await provider.classify({ filename: "unknown.pdf", mimeType: "application/pdf", requestedType: "RECEIPT" });
    expect(result.type).toBe("RECEIPT");
    expect(result.confidence).toBe(1);
  });

  it("routes bank statements to reconciliation instead of automatic posting", async () => {
    const provider = new MockDocumentAIProvider();
    const suggestions = await provider.analyzeAccounting({ tenantId: "tenant-a", type: "BANK_STATEMENT", extractedData: {} });
    expect(suggestions[0].proposedValue).toEqual({ workflow: "BANK_RECONCILIATION" });
  });
});
