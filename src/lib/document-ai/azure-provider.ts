import type { AccountingDocumentType, Prisma } from "@prisma/client";
import type { DocumentAIProvider, ExtractionResult } from "./types";

type AzureField = {
  type?: string;
  content?: string;
  confidence?: number;
  valueString?: string;
  valueNumber?: number;
  valueInteger?: number;
  valueDate?: string;
  valueTime?: string;
  valuePhoneNumber?: string;
  valueSelectionMark?: string;
  valueCurrency?: { amount?: number; currencyCode?: string };
  valueAddress?: Record<string, string>;
  valueArray?: AzureField[];
  valueObject?: Record<string, AzureField>;
};

type AzureResult = {
  status?: "notStarted" | "running" | "succeeded" | "failed" | "skipped";
  error?: { code?: string; message?: string; innererror?: { message?: string } };
  analyzeResult?: {
    content?: string;
    pages?: unknown[];
    documents?: Array<{ docType?: string; confidence?: number; fields?: Record<string, AzureField> }>;
    tables?: Array<{ rowCount?: number; columnCount?: number; cells?: Array<{ rowIndex: number; columnIndex: number; content?: string }> }>;
  };
};

const fieldNames: Record<string, string> = {
  InvoiceId: "documentNumber", InvoiceDate: "documentDate", DueDate: "dueDate",
  VendorName: "supplierName", VendorAddress: "supplierAddress", VendorAddressRecipient: "supplierContact",
  CustomerName: "customerName", CustomerId: "customerRegistrationNumber", CustomerAddress: "customerAddress",
  CustomerAddressRecipient: "customerContact", PurchaseOrder: "purchaseOrderNumber", PaymentTerm: "paymentTerms",
  SubTotal: "subtotal", TotalTax: "tax", InvoiceTotal: "total", AmountDue: "amountDue",
  PreviousUnpaidBalance: "previousUnpaidBalance", RemittanceAddress: "remittanceAddress", Items: "lines",
  MerchantName: "merchant", MerchantAddress: "merchantAddress", MerchantPhoneNumber: "merchantPhone",
  TransactionDate: "documentDate", TransactionTime: "transactionTime", ReceiptType: "receiptType",
  Total: "total", Tip: "tip", Tax: "tax", Description: "description", ProductCode: "sku",
  Quantity: "quantity", Unit: "unit", UnitPrice: "unitPrice", Price: "unitPrice", Amount: "lineTotal",
  TotalPrice: "lineTotal", TaxRate: "taxRate", TaxAmount: "taxAmount",
};

function normalizedName(name: string) {
  return fieldNames[name] || name.charAt(0).toLowerCase() + name.slice(1);
}

function fieldValue(field: AzureField): unknown {
  if (field.valueArray) return field.valueArray.map(fieldValue);
  if (field.valueObject) return Object.fromEntries(Object.entries(field.valueObject).map(([key, value]) => [normalizedName(key), fieldValue(value)]));
  if (field.valueCurrency) return { amount: field.valueCurrency.amount ?? null, currencyCode: field.valueCurrency.currencyCode ?? null };
  if (field.valueAddress) return field.valueAddress;
  return field.valueString ?? field.valueNumber ?? field.valueInteger ?? field.valueDate ?? field.valueTime ?? field.valuePhoneNumber ?? field.valueSelectionMark ?? field.content ?? null;
}

function collectConfidence(field: AzureField, path: string, output: Record<string, number>) {
  if (typeof field.confidence === "number") output[path] = field.confidence;
  field.valueArray?.forEach((child, index) => collectConfidence(child, `${path}.${index}`, output));
  if (field.valueObject) for (const [key, child] of Object.entries(field.valueObject)) collectConfidence(child, `${path}.${normalizedName(key)}`, output);
}

function tableRows(result: AzureResult) {
  return (result.analyzeResult?.tables ?? []).map((table) => {
    const rows = Array.from({ length: table.rowCount ?? 0 }, () => Array.from({ length: table.columnCount ?? 0 }, () => ""));
    for (const cell of table.cells ?? []) if (rows[cell.rowIndex]) rows[cell.rowIndex][cell.columnIndex] = cell.content ?? "";
    return rows;
  });
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "amount" in value && typeof value.amount === "number") return value.amount;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
}

function validation(data: Record<string, unknown>, pageCount: number): Prisma.InputJsonObject {
  const messages: string[] = ["Azure F0 processes only the first two pages. Confirm that all pages and line items are represented."];
  const subtotal = numberValue(data.subtotal);
  const tax = numberValue(data.tax);
  const total = numberValue(data.total);
  let difference: number | null = null;
  if (subtotal !== undefined && total !== undefined) {
    difference = Number(((subtotal + (tax ?? 0)) - total).toFixed(2));
    if (Math.abs(difference) > 0.02) messages.push(`Subtotal plus tax differs from the extracted total by ${difference.toFixed(2)}.`);
  }
  if (pageCount >= 2) messages.push("This result may be truncated because the free tier returned two pages.");
  return { passed: difference === null || Math.abs(difference) <= 0.02, reviewRequired: true, arithmeticDifference: difference, messages };
}

function classifyContent(content: string): { type: AccountingDocumentType; confidence: number; reason: string } {
  const text = content.toLowerCase();
  const match = (terms: string[]) => terms.some((term) => text.includes(term));
  if (match(["bank statement", "statement period", "opening balance", "closing balance"])) return { type: "BANK_STATEMENT", confidence: 0.85, reason: "The document contains bank statement and balance terminology." };
  if (match(["delivery order", "delivery note", "goods received"])) return { type: "DELIVERY_ORDER", confidence: 0.88, reason: "The document identifies itself as a delivery document." };
  if (match(["expense claim", "expense report", "employee claim"])) return { type: "EXPENSE_CLAIM", confidence: 0.86, reason: "The document contains employee expense claim terminology." };
  if (match(["credit note", "credit memo"])) return { type: "CREDIT_NOTE", confidence: 0.9, reason: "The document identifies itself as a credit note." };
  if (match(["debit note", "debit memo"])) return { type: "DEBIT_NOTE", confidence: 0.9, reason: "The document identifies itself as a debit note." };
  if (match(["supplier statement", "statement of account"])) return { type: "SUPPLIER_STATEMENT", confidence: 0.82, reason: "The document appears to be a supplier statement of account." };
  if (match(["receipt", "cashier", "change due"])) return { type: "RECEIPT", confidence: 0.78, reason: "The document contains retail receipt terminology." };
  if (match(["invoice", "amount due", "bill to"])) return { type: "PURCHASE_INVOICE", confidence: 0.76, reason: "The document appears to be an invoice; confirm whether it is a purchase or sales invoice." };
  return { type: "OTHER", confidence: 0.45, reason: "The layout OCR did not contain enough distinctive terminology for reliable classification." };
}

function modelFor(type: AccountingDocumentType) {
  if (type === "RECEIPT" || type === "EXPENSE_CLAIM") return "prebuilt-receipt";
  if (["PURCHASE_INVOICE", "SALES_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"].includes(type)) return "prebuilt-invoice";
  return "prebuilt-layout";
}

export class AzureDocumentAIProvider implements DocumentAIProvider {
  readonly name = "azure";
  readonly model = process.env.AZURE_DOCUMENT_MODEL || "prebuilt-models-v4";

  private credentials() {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    if (!endpoint || !key) throw new Error("Azure Document Intelligence is not configured. Add its endpoint and key to .env, then restart the application.");
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("Azure Document Intelligence endpoint must use HTTPS.");
    return { endpoint: url.origin, key };
  }

  private async analyze(modelId: string, bytes: Uint8Array): Promise<AzureResult> {
    const { endpoint, key } = this.credentials();
    const apiVersion = process.env.AZURE_DOCUMENT_API_VERSION || "2024-11-30";
    const timeoutMs = Number(process.env.DOCUMENT_AI_TIMEOUT_MS || 120000);
    const submitted = await fetch(`${endpoint}/documentintelligence/documentModels/${modelId}:analyze?_overload=analyzeDocument&api-version=${apiVersion}`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ base64Source: Buffer.from(bytes).toString("base64") }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!submitted.ok) {
      const detail = await submitted.text();
      throw new Error(`Azure document analysis could not start (${submitted.status}): ${detail.slice(0, 300)}`);
    }
    const operationLocation = submitted.headers.get("operation-location");
    if (!operationLocation) throw new Error("Azure did not return an analysis operation location.");
    const operation = new URL(operationLocation);
    if (operation.protocol !== "https:" || operation.origin !== endpoint) throw new Error("Azure returned an unexpected analysis operation location.");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const polled = await fetch(operation, { headers: { "Ocp-Apim-Subscription-Key": key }, signal: AbortSignal.timeout(Math.min(30000, timeoutMs)) });
      const result = await polled.json() as AzureResult;
      if (!polled.ok) throw new Error(result.error?.message || `Azure document analysis failed (${polled.status}).`);
      if (result.status === "succeeded") return result;
      if (result.status === "failed" || result.status === "skipped") throw new Error(result.error?.innererror?.message || result.error?.message || "Azure could not analyze this document.");
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    throw new Error("Azure document analysis timed out. Try the document again.");
  }

  async classify(input: { filename: string; mimeType: string; bytes?: Uint8Array; requestedType?: AccountingDocumentType }) {
    if (input.requestedType) return { type: input.requestedType, confidence: 1, reason: "User selected the document type." };
    if (!input.bytes) throw new Error("Document bytes are required for automatic classification.");
    const result = await this.analyze("prebuilt-layout", input.bytes);
    return classifyContent(result.analyzeResult?.content ?? "");
  }

  async extract(input: { type: AccountingDocumentType; filename: string; mimeType: string; bytes: Uint8Array }): Promise<ExtractionResult> {
    const result = await this.analyze(modelFor(input.type), input.bytes);
    const document = result.analyzeResult?.documents?.[0];
    const data: Record<string, unknown> = {};
    const fieldConfidences: Record<string, number> = {};
    for (const [key, field] of Object.entries(document?.fields ?? {})) {
      const name = normalizedName(key);
      data[name] = fieldValue(field);
      collectConfidence(field, name, fieldConfidences);
    }
    const tables = tableRows(result);
    if (tables.length && !data.tables) data.tables = tables;
    if (!Object.keys(data).length) data.rawText = (result.analyzeResult?.content ?? "").slice(0, 100000);
    const pageCount = result.analyzeResult?.pages?.length ?? 0;
    return {
      data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonObject,
      fieldConfidences,
      validation: validation(data, pageCount),
    };
  }

  async analyzeAccounting(input: { tenantId: string; type: AccountingDocumentType; extractedData: Prisma.InputJsonObject }) {
    if (input.type === "BANK_STATEMENT") return [{ type: "REVIEW_DESTINATION", proposedValue: { workflow: "BANK_RECONCILIATION" }, confidence: 1, reason: "Bank statement rows must be reviewed in reconciliation before posting." }];
    if (input.type === "SALES_INVOICE") return [{ type: "TRANSACTION_TYPE", proposedValue: { transaction: "SALES_INVOICE", controlAccount: "1200" }, confidence: 0.8, reason: "Confirm the customer and revenue account before creating the sales invoice." }];
    if (["PURCHASE_INVOICE", "RECEIPT", "EXPENSE_CLAIM"].includes(input.type)) return [{ type: "ACCOUNT_REVIEW", proposedValue: { workflow: "PURCHASE_OR_EXPENSE_REVIEW" }, confidence: 0.7, reason: "Select the appropriate account from this company's chart of accounts before posting." }];
    return [{ type: "REVIEW_DESTINATION", proposedValue: { workflow: "MANUAL_REVIEW" }, confidence: 0.7, reason: "Confirm the extraction and choose the appropriate accounting workflow." }];
  }
}
