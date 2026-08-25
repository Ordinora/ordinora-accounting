import type { AccountingDocumentType, Prisma } from "@prisma/client";
import { z } from "zod";
import type { DocumentAIProvider } from "./types";

const documentTypes = [
  "PURCHASE_INVOICE", "SALES_INVOICE", "RECEIPT", "EXPENSE_CLAIM", "BANK_STATEMENT",
  "DELIVERY_ORDER", "CREDIT_NOTE", "DEBIT_NOTE", "SUPPLIER_STATEMENT", "OTHER",
] as const satisfies readonly AccountingDocumentType[];

const classificationSchema = z.object({
  type: z.enum(documentTypes),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

const extractionSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  fieldConfidences: z.record(z.string(), z.number().min(0).max(1)),
  validation: z.record(z.string(), z.unknown()),
});

const classificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "confidence", "reason"],
  properties: {
    type: { type: "string", enum: documentTypes },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
};

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["data", "fieldConfidences", "validation"],
  properties: {
    data: { type: "object", additionalProperties: true },
    fieldConfidences: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 1 } },
    validation: { type: "object", additionalProperties: true },
  },
};

type OpenAIResponse = {
  error?: { message?: string };
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

function inputContent(input: { filename: string; mimeType: string; bytes: Uint8Array }) {
  const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`;
  if (input.mimeType.startsWith("image/")) return { type: "input_image", image_url: dataUrl, detail: "high" };
  return { type: "input_file", filename: input.filename, file_data: dataUrl };
}

function outputText(response: OpenAIResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("The AI provider returned no structured document data.");
}

function jsonValue(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export class OpenAIDocumentAIProvider implements DocumentAIProvider {
  readonly name = "openai";
  readonly model = process.env.DOCUMENT_AI_MODEL || "gpt-5.6-luna";

  private async respond(input: { prompt: string; filename: string; mimeType: string; bytes: Uint8Array; schemaName: string; schema: object }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI document extraction is not configured. Add OPENAI_API_KEY to .env and restart the application.");
    const endpoint = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const response = await fetch(`${endpoint}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [{ role: "user", content: [{ type: "input_text", text: input.prompt }, inputContent(input)] }],
        text: { format: { type: "json_schema", name: input.schemaName, strict: false, schema: input.schema } },
      }),
      signal: AbortSignal.timeout(Number(process.env.DOCUMENT_AI_TIMEOUT_MS || 120000)),
    });
    const payload = await response.json() as OpenAIResponse;
    if (!response.ok) throw new Error(payload.error?.message || `OpenAI document extraction failed (${response.status}).`);
    try {
      return JSON.parse(outputText(payload)) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("The AI provider returned invalid structured document data.");
      throw error;
    }
  }

  async classify(input: { filename: string; mimeType: string; bytes?: Uint8Array; requestedType?: AccountingDocumentType }) {
    if (input.requestedType) return { type: input.requestedType, confidence: 1, reason: "User selected the document type." };
    if (!input.bytes) throw new Error("Document bytes are required for automatic classification.");
    const result = await this.respond({
      ...input,
      bytes: input.bytes,
      schemaName: "accounting_document_classification",
      schema: classificationJsonSchema,
      prompt: "Classify this accounting document. Choose exactly one allowed type. Base the answer only on visible document content, not the filename. Return a short reason and an honest confidence from 0 to 1.",
    });
    return classificationSchema.parse(result);
  }

  async extract(input: { type: AccountingDocumentType; filename: string; mimeType: string; bytes: Uint8Array }) {
    const result = await this.respond({
      ...input,
      schemaName: "accounting_document_extraction",
      schema: extractionJsonSchema,
      prompt: `Extract all accounting information from this ${input.type.replaceAll("_", " ").toLowerCase()}.
Use the document's printed values exactly; never invent missing information. Use null for missing scalar fields and [] for missing lists.
For invoices and credit/debit notes include party details, registration/tax/address/contact details, document number, dates, currency, references, payment terms, unlimited line items (description, SKU, quantity, unit, unit price, discount, tax rate, tax amount, line total), subtotal, discount, tax, charges, shipping, rounding and total.
For receipts include merchant, date, time, receipt number, currency, payment method, items and totals.
For bank statements include bank/account identifiers, currency, statement dates, opening/closing balances, and every transaction with transaction date, value date, description, reference, debit, credit and balance.
For expense claims include employee, merchant, date, description, currency, amount, tax and expense type. For delivery orders include supplier/customer, order numbers, dates and every item/quantity.
Return data as descriptive camelCase fields. Return fieldConfidences keyed by field path with values from 0 to 1. Validation must include passed, reviewRequired, messages, and any arithmetic differences. Low-quality or unreadable content must be flagged for human review.`,
    });
    const parsed = extractionSchema.parse(result);
    return { data: jsonValue(parsed.data), fieldConfidences: parsed.fieldConfidences, validation: jsonValue(parsed.validation) };
  }

  async analyzeAccounting(input: { tenantId: string; type: AccountingDocumentType; extractedData: Prisma.InputJsonObject }) {
    if (input.type === "BANK_STATEMENT") return [{ type: "REVIEW_DESTINATION", proposedValue: { workflow: "BANK_RECONCILIATION" }, confidence: 1, reason: "Extracted bank transactions must be reviewed in bank reconciliation before posting." }];
    if (input.type === "SALES_INVOICE") return [{ type: "TRANSACTION_TYPE", proposedValue: { transaction: "SALES_INVOICE", controlAccount: "1200" }, confidence: 0.8, reason: "The document was classified as a sales invoice; confirm the customer and revenue account." }];
    if (["PURCHASE_INVOICE", "RECEIPT", "EXPENSE_CLAIM"].includes(input.type)) return [{ type: "ACCOUNT_REVIEW", proposedValue: { workflow: "PURCHASE_OR_EXPENSE_REVIEW" }, confidence: 0.7, reason: "Select the appropriate account from this company's chart of accounts before posting." }];
    return [{ type: "REVIEW_DESTINATION", proposedValue: { workflow: "MANUAL_REVIEW" }, confidence: 0.7, reason: "Confirm the extracted document and choose the appropriate accounting workflow." }];
  }
}
