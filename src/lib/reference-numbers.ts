import "server-only";
import { db } from "./db";

export const REFERENCE_PREFIXES = {
  SALES_QUOTATION: "SQ", SALES_ORDER: "SO", SUPPLIER_QUOTATION: "PQ", PURCHASE_ORDER: "PO", SALES_INVOICE: "SI", SUPPLIER_BILL: "PI", SALES_CREDIT_NOTE: "SCN", SUPPLIER_CREDIT_NOTE: "PCN",
  CUSTOMER_RECEIPT: "RC", SUPPLIER_PAYMENT: "SP", PAYMENT: "PAY", TRANSFER: "TRF", DAILY_SALE: "DS", MANUAL_JOURNAL: "MJ",
  INVENTORY_TRANSFER: "ITR", INVENTORY_ADJUSTMENT: "IADJ", MONTHLY_INVENTORY: "MIC", OPENING_INVENTORY: "OINV",
  PAYROLL: "PAYROLL", PAYROLL_PAYMENT: "PP", FINAL_PAY: "FP",
  OPENING_BALANCE: "OB", RECONCILIATION: "REC",
} as const;
export type ReferenceKind = keyof typeof REFERENCE_PREFIXES;

export async function resolveReference(input: { tenantId: string; kind: ReferenceKind; date: Date; supplied?: string | null; auto: boolean }) {
  const supplied = input.supplied?.trim();
  if (!input.auto) {
    if (!supplied) throw new Error("Enter a reference or select automatic reference.");
    return supplied;
  }
  const year = input.date.getUTCFullYear();
  // A tenant can already have imported, seeded, or manually numbered journals
  // from before automatic sequences were enabled. Advance the sequence until it
  // finds a genuinely unused ledger reference instead of failing at posting.
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const sequence = await db.referenceSequence.upsert({
      where: { tenantId_key_year: { tenantId: input.tenantId, key: input.kind, year } },
      create: { tenantId: input.tenantId, key: input.kind, year, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
    const value = sequence.nextValue - 1;
    const candidate = `${REFERENCE_PREFIXES[input.kind]}-${year}-${String(value).padStart(4, "0")}`;
    const exists = input.kind === "SALES_QUOTATION"
      ? await db.salesQuotation.findUnique({ where: { tenantId_reference: { tenantId: input.tenantId, reference: candidate } }, select: { id: true } })
      : input.kind === "SALES_ORDER"
        ? await db.salesOrder.findUnique({ where: { tenantId_reference: { tenantId: input.tenantId, reference: candidate } }, select: { id: true } })
        : input.kind === "SUPPLIER_QUOTATION"
          ? await db.supplierQuotation.findUnique({ where: { tenantId_reference: { tenantId: input.tenantId, reference: candidate } }, select: { id: true } })
          : input.kind === "PURCHASE_ORDER"
            ? await db.purchaseOrder.findUnique({ where: { tenantId_reference: { tenantId: input.tenantId, reference: candidate } }, select: { id: true } })
        : await db.journal.findUnique({ where: { tenantId_reference: { tenantId: input.tenantId, reference: candidate } }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error("Unable to allocate an automatic reference. Review the reference numbering sequence.");
}
