import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { openingControlBalance } from "./opening-control";
import { deriveOpeningChecklist } from "./opening-checklist";
import { reconcileControlToSubledger } from "./opening-subledgers";

export async function openingSetupReview(tenantId: string) {
  const [opening, receivables, payables, inventoryItemCount, openingInventoryCount, fixedAssetAccountCount, fixedAssetCount, activeEmployeeCount, openingPayrollCount] = await Promise.all([
    db.journal.findFirst({ where: { tenantId, source: "OPENING_BALANCE", status: "POSTED", description: "Opening balances at conversion date" }, include: { lines: { include: { account: true } } }, orderBy: { accountingDate: "desc" } }),
    db.salesInvoice.findMany({ where: { tenantId, isOpeningBalance: true, status: { not: "VOIDED" } }, select: { baseTotal: true } }),
    db.supplierBill.findMany({ where: { tenantId, isOpeningBalance: true, status: { not: "VOIDED" } }, select: { baseTotal: true } }),
    db.inventoryItem.count({ where: { tenantId, isActive: true } }),
    db.inventoryMovement.count({ where: { tenantId, type: "OPENING" } }),
    db.account.count({ where: { tenantId, isActive: true, type: "ASSET", code: { startsWith: "15" } } }),
    db.fixedAsset.count({ where: { tenantId } }),
    db.employee.count({ where: { tenantId, status: "ACTIVE" } }),
    db.openingPayrollYtd.count({ where: { tenantId, employee: { status: "ACTIVE" } } }),
  ]);
  const zero = new Prisma.Decimal(0);
  const ar = reconcileControlToSubledger({ controlBalance: openingControlBalance(opening?.lines, "RECEIVABLE"), documents: receivables });
  const ap = reconcileControlToSubledger({ controlBalance: openingControlBalance(opening?.lines, "PAYABLE"), documents: payables });
  return deriveOpeningChecklist({ hasOpeningJournal: Boolean(opening), receivables: { reconciled: ar.reconciled, supportingAmount: ar.subledgerBalance.abs().gt(zero) ? 1 : 0 }, payables: { reconciled: ap.reconciled, supportingAmount: ap.subledgerBalance.abs().gt(zero) ? 1 : 0 }, inventoryItemCount, openingInventoryCount, fixedAssetAccountCount, fixedAssetCount, activeEmployeeCount, openingPayrollCount });
}
