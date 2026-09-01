import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

const zero = new Prisma.Decimal(0);
const settledBase = (payment: { baseAmount: Prisma.Decimal; discountBaseAmount: Prisma.Decimal; allocations: Array<{ carryingBaseAmount: Prisma.Decimal }> }) => payment.allocations.reduce((sum, allocation) => sum.add(allocation.carryingBaseAmount), zero);

export async function supplierSummary(tenantId: string, from: Date, to: Date) {
  const suppliers = await db.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" }, include: { bills: { where: { billDate: { lte: to }, status: { not: "VOIDED" } } }, creditNotes: { where: { creditDate: { lte: to } } }, payments: { where: { paymentDate: { lte: to } }, include: { allocations: true } } } });
  return suppliers.map((supplier) => {
    const activePayments = supplier.payments.filter((payment) => payment.chequeStatus !== "RETURNED");
    const bills = supplier.bills.filter((item) => item.billDate >= from).reduce((sum, item) => sum.add(item.baseTotal), zero);
    const credits = supplier.creditNotes.filter((item) => item.creditDate >= from).reduce((sum, item) => sum.add(item.baseTotal), zero);
    const payments = activePayments.filter((item) => item.paymentDate >= from).reduce((sum, item) => sum.add(settledBase(item)), zero);
    const outstanding = supplier.bills.reduce((sum, item) => sum.add(item.baseTotal), zero).sub(supplier.creditNotes.reduce((sum, item) => sum.add(item.baseTotal), zero)).sub(activePayments.reduce((sum, item) => sum.add(settledBase(item)), zero));
    return { id: supplier.id, code: supplier.code, name: supplier.name, currency: supplier.currencyCode, bills, credits, payments, outstanding };
  }).filter((item) => !item.bills.eq(0) || !item.credits.eq(0) || !item.payments.eq(0) || !item.outstanding.eq(0));
}

export async function supplierStatement(tenantId: string, supplierId: string, from: Date, to: Date) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId }, include: { bills: { where: { billDate: { lte: to }, status: { not: "VOIDED" } } }, creditNotes: { where: { creditDate: { lte: to } } }, payments: { where: { paymentDate: { lte: to } }, include: { allocations: true } } } });
  if (!supplier) return null;
  const activePayments = supplier.payments.filter((payment) => payment.chequeStatus !== "RETURNED");
  const opening = supplier.bills.filter((item) => item.billDate < from).reduce((sum, item) => sum.add(item.baseTotal), zero)
    .sub(supplier.creditNotes.filter((item) => item.creditDate < from).reduce((sum, item) => sum.add(item.baseTotal), zero))
    .sub(activePayments.filter((item) => item.paymentDate < from).reduce((sum, item) => sum.add(settledBase(item)), zero));
  const transactions = [
    ...supplier.bills.filter((item) => item.billDate >= from).map((item) => ({ id: `bill-${item.id}`, date: item.billDate, type: item.isOpeningBalance ? "Opening bill" : "Purchase invoice", reference: item.reference, description: item.description ?? "Purchase invoice", debit: zero, credit: item.baseTotal })),
    ...supplier.creditNotes.filter((item) => item.creditDate >= from).map((item) => ({ id: `credit-${item.id}`, date: item.creditDate, type: "Debit note", reference: item.reference, description: item.description, debit: item.baseTotal, credit: zero })),
    ...activePayments.filter((item) => item.paymentDate >= from).map((item) => ({ id: `payment-${item.id}`, date: item.paymentDate, type: "Payment", reference: item.reference, description: item.discountBaseAmount.gt(0) ? `Supplier payment ${item.currency} ${Number(item.foreignAmount).toFixed(2)} + discount ${item.currency} ${Number(item.discountForeignAmount).toFixed(2)}` : "Supplier payment", debit: settledBase(item), credit: zero })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime() || left.reference.localeCompare(right.reference));
  let running = opening;
  const rows = transactions.map((item) => { running = running.add(item.credit).sub(item.debit); return { ...item, balance: running }; });
  return { id: supplier.id, code: supplier.code, name: supplier.name, currency: supplier.currencyCode, opening, rows, closing: running };
}
