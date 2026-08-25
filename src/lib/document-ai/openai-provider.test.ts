import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIDocumentAIProvider } from "./openai-provider";

const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

describe("OpenAI document AI provider", () => {
  it("does not call the API when the user selected a document type", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await new OpenAIDocumentAIProvider().classify({ filename: "invoice.pdf", mimeType: "application/pdf", requestedType: "PURCHASE_INVOICE" });
    expect(result.type).toBe("PURCHASE_INVOICE");
    expect(result.confidence).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends PDFs as private file input and parses structured extraction", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const extracted = { data: { documentNumber: "INV-42", total: "125.50" }, fieldConfidences: { documentNumber: 0.99, total: 0.98 }, validation: { passed: true, reviewRequired: true, messages: [] } };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(extracted) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await new OpenAIDocumentAIProvider().extract({ type: "PURCHASE_INVOICE", filename: "invoice.pdf", mimeType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) });
    expect(result.data.documentNumber).toBe("INV-42");
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.store).toBe(false);
    expect(body.input[0].content[1].type).toBe("input_file");
    expect(body.input[0].content[1].file_data).toMatch(/^data:application\/pdf;base64,/);
  });
});
