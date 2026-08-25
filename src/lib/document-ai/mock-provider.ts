import type { AccountingDocumentType, Prisma } from "@prisma/client";
import type { DocumentAIProvider } from "./types";

function inferredType(filename: string): AccountingDocumentType {
  const value = filename.toLowerCase();
  if (value.includes("bank") || value.includes("statement")) return "BANK_STATEMENT";
  if (value.includes("receipt")) return "RECEIPT";
  if (value.includes("sales")) return "SALES_INVOICE";
  if (value.includes("delivery") || value.includes("do-")) return "DELIVERY_ORDER";
  if (value.includes("expense")) return "EXPENSE_CLAIM";
  if (value.includes("credit")) return "CREDIT_NOTE";
  return "PURCHASE_INVOICE";
}

function extracted(type: AccountingDocumentType, filename: string): Prisma.InputJsonObject {
  const common = { sourceFilename: filename, mockExtraction: true, currency: "BND", documentDate: new Date().toISOString().slice(0, 10) };
  if (type === "BANK_STATEMENT") return { ...common, bankAccount: "Review required", openingBalance: "0.00", closingBalance: "0.00", transactions: [] };
  if (type === "RECEIPT") return { ...common, merchant: "Review required", receiptNumber: "Review required", total: "0.00", paymentMethod: "Review required", items: [] };
  if (type === "DELIVERY_ORDER") return { ...common, supplier: "Review required", deliveryOrderNumber: "Review required", purchaseOrderNumber: null, items: [] };
  if (type === "EXPENSE_CLAIM") return { ...common, employee: "Review required", merchant: "Review required", description: "Review required", total: "0.00" };
  return { ...common, partyName: "Review required", documentNumber: "Review required", dueDate: null, subtotal: "0.00", tax: "0.00", total: "0.00", lines: [] };
}

export class MockDocumentAIProvider implements DocumentAIProvider {
  readonly name = "mock";
  readonly model = process.env.DOCUMENT_AI_MODEL || "mock-accounting-v1";

  async classify(input: { filename: string; mimeType: string; requestedType?: AccountingDocumentType }) {
    return {
      type: input.requestedType ?? inferredType(input.filename),
      confidence: input.requestedType ? 1 : 0.72,
      reason: input.requestedType ? "User selected the document type." : "Mock classification based on the filename.",
    };
  }

  async extract(input: { type: AccountingDocumentType; filename: string; mimeType: string; bytes: Uint8Array }) {
    return {
      data: extracted(input.type, input.filename),
      fieldConfidences: { documentType: 0.72, documentDate: 0.55, partyName: 0.25, documentNumber: 0.25, total: 0.2 },
      validation: { passed: false, reviewRequired: true, messages: ["Mock mode does not perform OCR. Verify every extracted field manually."] },
    };
  }

  async analyzeAccounting(input: { tenantId: string; type: AccountingDocumentType; extractedData: Prisma.InputJsonObject }) {
    if (input.type === "BANK_STATEMENT") return [{ type: "REVIEW_DESTINATION", proposedValue: { workflow: "BANK_RECONCILIATION" }, confidence: 0.9, reason: "Bank transactions require reconciliation and must not be posted automatically." }];
    if (input.type === "SALES_INVOICE") return [{ type: "TRANSACTION_TYPE", proposedValue: { transaction: "SALES_INVOICE", controlAccount: "1200" }, confidence: 0.7, reason: "The document was classified as a sales invoice." }];
    if (input.type === "PURCHASE_INVOICE" || input.type === "RECEIPT" || input.type === "EXPENSE_CLAIM") return [{ type: "EXPENSE_ACCOUNT", proposedValue: { accountCode: "6300", accountName: "Office and administration" }, confidence: 0.45, reason: "Low-confidence mock suggestion. Confirm against the document and supplier history." }];
    return [{ type: "REVIEW_DESTINATION", proposedValue: { workflow: "MANUAL_REVIEW" }, confidence: 0.5, reason: "No automated accounting treatment is configured for this document type." }];
  }
}
