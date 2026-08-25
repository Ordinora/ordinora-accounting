import "server-only";
import { db } from "./db";
import { allocatedCashExpense } from "./cash-basis-calculations";

export async function calculateCashBasisProfit(tenantId: string, from?: Date, to?: Date) {
  const receiptDate = { ...(from && { gte: from }), ...(to && { lte: to }) }, paymentDate = { ...(from && { gte: from }), ...(to && { lte: to }) }, registerDate = { ...(from && { gte: from }), ...(to && { lte: to }) };
  const [receipts, cashSales, supplierPayments, directExpenseLines] = await Promise.all([
    db.customerReceipt.aggregate({ where: { tenantId, ...(from || to ? { receiptDate } : {}) }, _sum: { baseAmount: true } }),
    db.dailyCashRegister.aggregate({ where: { tenantId, ...(from || to ? { registerDate } : {}) }, _sum: { salesTotal: true } }),
    db.supplierPayment.findMany({ where: { tenantId, ...(from || to ? { paymentDate } : {}) }, include: { allocations: { include: { bill: { include: { lines: { include: { expenseAccount: true } } } } } } } }),
    db.paymentLine.aggregate({ where: { payment: { tenantId, ...(from || to ? { paymentDate } : {}) }, account: { type: "EXPENSE" } }, _sum: { baseAmount: true } }),
  ]);
  const allocations = supplierPayments.flatMap(payment => payment.allocations.map(allocation => ({ settlementBaseAmount: Number(allocation.settlementBaseAmount), billForeignTotal: Number(allocation.bill.foreignTotal), expenseForeignTotal: allocation.bill.lines.filter(line => line.expenseAccount.type === "EXPENSE").reduce((sum, line) => sum + Number(line.lineTotal), 0) })));
  const customerReceipts = Number(receipts._sum.baseAmount ?? 0), registerSales = Number(cashSales._sum.salesTotal ?? 0), supplierExpenses = allocatedCashExpense(allocations), directExpenses = Number(directExpenseLines._sum.baseAmount ?? 0);
  const cashIncome = customerReceipts + registerSales, cashExpenses = supplierExpenses + directExpenses;
  return { customerReceipts, registerSales, supplierExpenses, directExpenses, cashIncome, cashExpenses, netProfit: cashIncome - cashExpenses };
}
