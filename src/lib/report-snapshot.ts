import "server-only";
import { Prisma } from "@prisma/client";
import { calculateBalanceSheet } from "./financial-statements";
import { balanceSheetPdfSections } from "./balance-sheet-report";
import { calculateProfitLoss } from "./profit-loss";
import { profitLossPdfSections } from "./profit-loss-report";
import type { PdfSection } from "./report-pdf";
import { agedPayables, agedReceivables, inventoryValuation, ledgerBalances } from "./reports";

export type ReportSnapshot = { title: string; subtitle: string; currency: string; sections: PdfSection[] };
const zero = new Prisma.Decimal(0);
const formatDate = (date: Date) => date.toLocaleDateString("en-GB");

export async function buildReportSnapshot(tenant: { id: string; defaultCurrency: string }, type: string, from: Date, asOf: Date): Promise<ReportSnapshot> {
  const amount = (value: Prisma.Decimal) => `${tenant.defaultCurrency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let title = "", subtitle = "", sections: PdfSection[] = [];
  if (type === "trial-balance") {
    title = "Trial Balance"; subtitle = `As at ${formatDate(asOf)}`;
    const rows = await ledgerBalances(tenant.id, undefined, asOf), debits = rows.reduce((sum, row) => sum.add(row.balance.gt(0) ? row.balance : zero), zero), credits = rows.reduce((sum, row) => sum.add(row.balance.lt(0) ? row.balance.abs() : zero), zero);
    sections = [{ title: "Accounts", rows: [...rows.map(row => ({ label: `${row.code}  ${row.name}`, detail: row.balance.gt(0) ? `Debit ${amount(row.balance)}` : "", amount: row.balance.lt(0) ? `Credit ${amount(row.balance.abs())}` : "" })), { label: "Total debits", amount: amount(debits), strong: true }, { label: "Total credits", amount: amount(credits), strong: true }, { label: "Difference", amount: amount(debits.sub(credits)), strong: true }] }];
  } else if (type === "profit-loss" || type === "income-statement" || type === "revenue-statement") {
    title = type === "income-statement" ? "Income Statement" : type === "revenue-statement" ? "Revenue Statement" : "Profit & Loss"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)}`;
    sections = profitLossPdfSections(calculateProfitLoss(await ledgerBalances(tenant.id, from, asOf)), amount);
  } else if (type === "balance-sheet") {
    title = "Balance Sheet"; subtitle = `As at ${formatDate(asOf)}`;
    const statement = calculateBalanceSheet(await ledgerBalances(tenant.id, undefined, asOf));
    sections = balanceSheetPdfSections(statement, amount);
  } else if (type === "receivables" || type === "payables") {
    title = type === "receivables" ? "Aged Receivables" : "Aged Payables"; subtitle = `As at ${formatDate(asOf)}`;
    const rows = type === "receivables" ? await agedReceivables(tenant.id, asOf) : await agedPayables(tenant.id, asOf);
    sections = [{ title: type === "receivables" ? "Customer balances" : "Supplier balances", rows: [...rows.map(row => ({ label: `${row.reference}  ${row.party}`, detail: `${formatDate(row.due)}  ${row.bucket}`, amount: amount(row.outstanding) })), { label: "Total outstanding", amount: amount(rows.reduce((sum, row) => sum.add(row.outstanding), zero)), strong: true }] }];
  } else if (type === "inventory") {
    title = "Inventory Valuation"; subtitle = `As at ${formatDate(asOf)}`;
    const rows = await inventoryValuation(tenant.id, asOf);
    sections = [{ title: "Inventory", rows: [...rows.map(row => ({ label: `${row.sku}  ${row.item}`, detail: `${row.location}  Qty ${Number(row.quantity).toFixed(4)}`, amount: amount(row.value) })), { label: "Total inventory value", amount: amount(rows.reduce((sum, row) => sum.add(row.value), zero)), strong: true }] }];
  } else throw new Error("This report type cannot be published.");
  return { title, subtitle, currency: tenant.defaultCurrency, sections };
}
