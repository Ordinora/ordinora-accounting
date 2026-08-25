import { afterEach, describe, expect, it, vi } from "vitest";
import { AzureDocumentAIProvider } from "./azure-provider";

const originalEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const originalKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalEndpoint === undefined) delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT; else process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = originalEndpoint;
  if (originalKey === undefined) delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY; else process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = originalKey;
});

describe("Azure document AI provider", () => {
  it("does not call Azure for a user-selected classification", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await new AzureDocumentAIProvider().classify({ filename: "invoice.pdf", mimeType: "application/pdf", requestedType: "PURCHASE_INVOICE" });
    expect(result.type).toBe("PURCHASE_INVOICE");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits and polls an invoice, then normalizes its fields", async () => {
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = "https://ordinora.cognitiveservices.azure.com";
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 202, headers: { "operation-location": "https://ordinora.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/result-1?api-version=2024-11-30" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "succeeded", analyzeResult: { pages: [{}], documents: [{ fields: { VendorName: { valueString: "ABC Supplies", confidence: 0.98 }, InvoiceId: { valueString: "INV-42", confidence: 0.99 }, InvoiceTotal: { valueCurrency: { amount: 125.5, currencyCode: "BND" }, confidence: 0.97 } } }] } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await new AzureDocumentAIProvider().extract({ type: "PURCHASE_INVOICE", filename: "invoice.pdf", mimeType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) });
    expect(result.data.supplierName).toBe("ABC Supplies");
    expect(result.data.documentNumber).toBe("INV-42");
    expect(result.fieldConfidences.documentNumber).toBe(0.99);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toContain("prebuilt-invoice:analyze");
  });
});
