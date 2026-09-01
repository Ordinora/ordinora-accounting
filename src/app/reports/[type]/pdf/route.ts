import { Prisma } from "@prisma/client";
import { calculateBalanceSheet } from "@/lib/financial-statements";
import { balanceSheetPdfSections } from "@/lib/balance-sheet-report";
import { cashFlowStatement, type CashFlowActivity } from "@/lib/cash-flow";
import { bankAccountSummary, receiptsPaymentsSummary } from "@/lib/cash-account-reports";
import { customerStatement, customerSummary } from "@/lib/customer-reports";
import { statementOfChangesInEquity } from "@/lib/equity-statement";
import { fixedAssetReportRows } from "@/lib/fixed-asset-reports";
import { generalLedgerReport } from "@/lib/general-ledger-report";
import { inventoryCostingWorksheet, inventoryProfitMargin, inventoryQuantityByLocation, inventoryQuantityMovementSummary } from "@/lib/inventory-analysis";
import { generateReportPdf, type PdfSection } from "@/lib/report-pdf";
import { calculateProfitLoss } from "@/lib/profit-loss";
import { profitLossPdfSections } from "@/lib/profit-loss-report";
import { employeePayrollSummary, payrollEntriesForPeriod, payrollEntryGross, payrollReportTotals, payslipItemSummary } from "@/lib/payroll-reports";
import { agedPayables, agedReceivables, inventoryValuation, ledgerBalances } from "@/lib/reports";
import { requireActiveTenant } from "@/lib/session";
import { formatCurrencyAmount } from "@/lib/currency";
import { salesByCustomer, salesByItem } from "@/lib/sales-reports";
import { supplierStatement, supplierSummary } from "@/lib/supplier-reports";

export const dynamic = "force-dynamic";
const zero = new Prisma.Decimal(0);
const parseDate = (value: string | null, fallback: Date) => { if (!value) return fallback; const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? fallback : date; };
const formatDate = (date: Date) => date.toLocaleDateString("en-GB", { timeZone: "UTC" });

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const { active } = await requireActiveTenant();
  const url = new URL(request.url), now = new Date();
  const asOf = parseDate(url.searchParams.get("asOf") ?? url.searchParams.get("to"), now);
  const from = parseDate(url.searchParams.get("from"), new Date(now.getFullYear(), 0, 1));
  const amount = (value: Prisma.Decimal) => formatCurrencyAmount(active.defaultCurrency, value);
  let title = "", subtitle = "", sections: PdfSection[] = [];

  if (type === "trial-balance") {
    title = "Trial Balance"; subtitle = `As at ${formatDate(asOf)}`;
    const rows = await ledgerBalances(active.id, undefined, asOf);
    const debits = rows.reduce((sum, row) => sum.add(row.balance.gt(0) ? row.balance : zero), zero);
    const credits = rows.reduce((sum, row) => sum.add(row.balance.lt(0) ? row.balance.abs() : zero), zero);
    sections = [{ title: "Accounts", rows: [...rows.map((row) => ({ label: `${row.code}  ${row.name}`, detail: row.balance.gt(0) ? `Debit ${amount(row.balance)}` : "", amount: row.balance.lt(0) ? `Credit ${amount(row.balance.abs())}` : "" })), { label: "Total debits", amount: amount(debits), strong: true }, { label: "Total credits", amount: amount(credits), strong: true }, { label: "Difference", amount: amount(debits.sub(credits)), strong: true }] }];
  } else if (type === "profit-loss" || type === "income-statement" || type === "revenue-statement") {
    title = type === "income-statement" ? "Income Statement" : type === "revenue-statement" ? "Revenue Statement" : "Profit & Loss"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)} | Accrual accounting`;
    sections = profitLossPdfSections(calculateProfitLoss(await ledgerBalances(active.id, from, asOf, { excludeYearEndClosing: true })), amount);
  } else if (type === "balance-sheet") {
    title = "Balance Sheet"; subtitle = `As at ${formatDate(asOf)}`;
    const statement = calculateBalanceSheet(await ledgerBalances(active.id, undefined, asOf));
    sections = balanceSheetPdfSections(statement, amount);
  } else if (type === "cash-flow") {
    title = "Cash Flow Statement"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)} | Direct method`;
    const statement = await cashFlowStatement(active.id, from, asOf), names: Record<CashFlowActivity,string> = { OPERATING:"Operating activities", INVESTING:"Investing activities", FINANCING:"Financing activities" };
    sections = (["OPERATING","INVESTING","FINANCING"] as CashFlowActivity[]).map(activity => { const total = activity === "OPERATING" ? statement.operating : activity === "INVESTING" ? statement.investing : statement.financing; return { title:names[activity], rows:[...statement.rows.filter(row=>row.activity===activity).map(row=>({label:`${formatDate(row.date)}  ${row.reference}`,detail:row.description,amount:amount(row.amount)})),{label:`Net cash from ${names[activity].toLowerCase()}`,amount:amount(total),strong:true}] }; });
    sections.push({ title:"Cash reconciliation", rows:[{label:"Opening / brought-forward cash and cash equivalents",amount:amount(statement.openingCash)},{label:"Net change in cash",amount:amount(statement.netChange)},{label:"Closing cash and cash equivalents",amount:amount(statement.closingCash),strong:true}] });
  } else if (type === "changes-in-equity") {
    title = "Statement of Changes in Equity"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)} | Accrual accounting`;
    const statement = await statementOfChangesInEquity(active.id, from, asOf);
    sections = [{ title: "Equity components", rows: [
      ...statement.rows.map((row) => ({ label: `${row.code}  ${row.name}`, detail: `Opening ${amount(row.opening)} | Movement ${amount(row.movement)}`, amount: amount(row.closing) })),
      { label: "Accumulated current earnings", detail: `Opening ${amount(statement.openingProfit)} | Period profit ${amount(statement.periodProfit)}`, amount: amount(statement.openingProfit.add(statement.periodProfit)) },
      { label: "Opening equity", amount: amount(statement.openingTotal), strong: true },
      { label: "Total movement", amount: amount(statement.movementTotal), strong: true },
      { label: "Closing equity", amount: amount(statement.closingTotal), strong: true },
    ] }];
  } else if(type==="receipts-payments-summary"){
    title="Receipts & Payments Summary";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const report=await receiptsPaymentsSummary(active.id,from,asOf);sections=[{title:"Transaction sources",rows:[...report.rows.map(row=>({label:row.source,detail:`${row.count} cash entries | Receipts ${amount(row.receipts)} | Payments ${amount(row.payments)}`,amount:amount(row.receipts.sub(row.payments))})),{label:"Total receipts",amount:amount(report.receipts),strong:true},{label:"Total payments",amount:amount(report.payments),strong:true},{label:"Net cash movement",amount:amount(report.net),strong:true}]}];
  } else if(type==="bank-account-summary"){
    title="Bank Account Summary";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await bankAccountSummary(active.id,from,asOf);sections=[{title:"Cash and bank accounts",rows:rows.map(row=>({label:`${row.code}  ${row.name}`,detail:`Opening ${amount(row.opening)} | Receipts ${amount(row.receipts)} | Payments ${amount(row.payments)} | ${row.transactions} entries`,amount:amount(row.closing)}))}];
  } else if (type === "general-ledger-summary") {
    title = "General Ledger Summary"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)}`;
    const rows = await generalLedgerReport(active.id, from, asOf);
    sections = [{ title: "Ledger accounts", rows: rows.map(row => ({ label: `${row.code}  ${row.name}`, detail: `Opening ${amount(row.opening)} | Debit ${amount(row.debit)} | Credit ${amount(row.credit)}`, amount: amount(row.closing) })) }];
  } else if (type === "general-ledger-transactions") {
    const accountId = url.searchParams.get("accountId") ?? undefined, rows = await generalLedgerReport(active.id, from, asOf, accountId), account = rows[0];
    if (!account) return new Response("Ledger account activity not found", { status: 404 });
    title = "General Ledger Transactions"; subtitle = `${account.code} ${account.name} | ${formatDate(from)} to ${formatDate(asOf)}`;
    sections = [{ title: "Posted transactions", rows: [...account.lines.map(line => ({ label: `${formatDate(line.date)}  ${line.reference}`, detail: `${line.description} | Debit ${amount(line.debit)} | Credit ${amount(line.credit)}`, amount: amount(line.balance) })), { label: "Opening balance", amount: amount(account.opening), strong: true }, { label: "Closing balance", amount: amount(account.closing), strong: true }] }];
  } else if (type === "customer-summary") {
    title="Customer Summary";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await customerSummary(active.id,from,asOf);
    sections=[{title:"Customers",rows:rows.map(row=>({label:`${row.code}  ${row.name}`,detail:`Invoices ${amount(row.invoices)} | Credits ${amount(row.credits)} | Receipts ${amount(row.receipts)}`,amount:amount(row.outstanding)}))}];
  } else if (type === "customer-statement") {
    const customerId=url.searchParams.get("customerId");if(!customerId)return new Response("Select a customer",{status:400});const statement=await customerStatement(active.id,customerId,from,asOf);if(!statement)return new Response("Customer not found",{status:404});
    title="Customer Statement";subtitle=`${statement.code} ${statement.name} | ${formatDate(from)} to ${formatDate(asOf)}`;sections=[{title:"Transactions",rows:[...statement.rows.map(row=>({label:`${formatDate(row.date)}  ${row.reference}`,detail:`${row.type} | ${row.description} | Debit ${amount(row.debit)} | Credit ${amount(row.credit)}`,amount:amount(row.balance)})),{label:"Opening balance",amount:amount(statement.opening),strong:true},{label:"Closing balance",amount:amount(statement.closing),strong:true}]}];
  } else if (type === "supplier-summary") {
    title="Supplier Summary";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await supplierSummary(active.id,from,asOf);sections=[{title:"Suppliers",rows:rows.map(row=>({label:`${row.code}  ${row.name}`,detail:`Bills ${amount(row.bills)} | Debit notes ${amount(row.credits)} | Payments ${amount(row.payments)}`,amount:amount(row.outstanding)}))}];
  } else if (type === "supplier-statement") {
    const supplierId=url.searchParams.get("supplierId");if(!supplierId)return new Response("Select a supplier",{status:400});const statement=await supplierStatement(active.id,supplierId,from,asOf);if(!statement)return new Response("Supplier not found",{status:404});title="Supplier Statement";subtitle=`${statement.code} ${statement.name} | ${formatDate(from)} to ${formatDate(asOf)}`;sections=[{title:"Transactions",rows:[...statement.rows.map(row=>({label:`${formatDate(row.date)}  ${row.reference}`,detail:`${row.type} | ${row.description} | Debit ${amount(row.debit)} | Credit ${amount(row.credit)}`,amount:amount(row.balance)})),{label:"Opening payable",amount:amount(statement.opening),strong:true},{label:"Closing payable",amount:amount(statement.closing),strong:true}]}];
  } else if (type === "sales-by-customer") {
    title="Sales Invoice Totals by Customer";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await salesByCustomer(active.id,from,asOf);sections=[{title:"Customers",rows:rows.map(row=>({label:`${row.code}  ${row.name}`,detail:`${row.invoiceCount} invoices | Gross ${amount(row.gross)} | Credits ${amount(row.credits)}`,amount:amount(row.net)}))}];
  } else if (type === "sales-by-item") {
    title="Sales Invoice Totals by Item";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await salesByItem(active.id,from,asOf);sections=[{title:"Items and sales lines",rows:rows.map(row=>({label:`${row.sku}  ${row.name}`,detail:`${row.invoiceCount} invoices | Quantity ${Number(row.quantity).toLocaleString("en-US",{maximumFractionDigits:4})} ${row.unit} | ${row.account}`,amount:amount(row.gross)}))}];
  } else if (type === "inventory-quantity-summary") {
    title="Inventory Quantity Summary";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await inventoryQuantityMovementSummary(active.id,from,asOf);sections=[{title:"Inventory items",rows:rows.map(row=>({label:`${row.sku}  ${row.name}`,detail:`Opening ${Number(row.openingQuantity).toLocaleString("en-US",{maximumFractionDigits:4})} | In ${Number(row.quantityIn).toLocaleString("en-US",{maximumFractionDigits:4})} | Out ${Number(row.quantityOut).toLocaleString("en-US",{maximumFractionDigits:4})} | Closing ${Number(row.closingQuantity).toLocaleString("en-US",{maximumFractionDigits:4})} ${row.unit} | Average cost ${amount(row.averageCost)}`,amount:amount(row.closingValue)}))}];
  } else if (type === "inventory-profit-margin") {
    title="Inventory Profit Margin";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await inventoryProfitMargin(active.id,from,asOf);sections=[{title:"Inventory items",rows:rows.map(row=>({label:`${row.sku}  ${row.name}`,detail:`Revenue ${amount(row.revenue)} | COGS ${amount(row.cogs)} | Margin ${Number(row.margin).toFixed(2)}%`,amount:amount(row.profit)}))}];
  } else if (type === "inventory-quantity-by-location") {
    title="Inventory Quantity by Location";subtitle=`As at ${formatDate(asOf)}`;const rows=await inventoryQuantityByLocation(active.id,asOf);sections=[{title:"Location balances",rows:rows.map(row=>({label:`${row.locationCode}  ${row.sku}  ${row.item}`,detail:`${row.location} | ${row.branch} | Quantity ${Number(row.quantity).toFixed(4)} ${row.unit}`,amount:amount(row.value)}))}];
  } else if (type === "inventory-costing-worksheet") {
    title="Inventory Costing Calculation Worksheet";subtitle=`For the period ${formatDate(from)} to ${formatDate(asOf)}`;const rows=await inventoryCostingWorksheet(active.id,from,asOf);sections=[{title:`${active.inventoryCostingMethod==="FIFO"?"FIFO":"Weighted-average"} cost reconciliation`,rows:rows.map(row=>({label:`${row.sku}  ${row.name}`,detail:`Opening ${amount(row.openingValue)} | Purchases ${amount(row.purchaseValue)} | COGS ${amount(row.saleCost)} | Other ${amount(row.otherValue)} | Closing qty ${Number(row.closingQty).toFixed(4)}`,amount:amount(row.closingValue)}))}];
  } else if (type === "fixed-assets") {
    title = "Fixed Asset Summary"; subtitle = `As at ${formatDate(asOf)} | Posted depreciation basis`;
    const rows = await fixedAssetReportRows(active.id, asOf), cost = rows.reduce((s, r) => s.add(r.asset.originalCost), zero), accumulated = rows.reduce((s, r) => s.add(r.actualAccumulated), zero), book = rows.reduce((s, r) => s.add(r.actualBookValue), zero);
    sections = [{ title: "Fixed assets", rows: [...rows.map(r => ({ label: `${r.asset.assetCode}  ${r.asset.name}`, detail: `${r.asset.category} | ${r.asset.status.replaceAll("_", " ")}`, amount: amount(new Prisma.Decimal(r.actualBookValue)) })), { label: "Original cost", amount: amount(cost), strong: true }, { label: "Accumulated depreciation", amount: amount(accumulated), strong: true }, { label: "Net book value", amount: amount(book), strong: true }] }];
  } else if (type === "depreciation-worksheet") {
    title = "Depreciation Calculation Worksheet"; subtitle = `As at ${formatDate(asOf)} | Straight-line schedule`;
    const rows = await fixedAssetReportRows(active.id, asOf), due = rows.reduce((s, r) => s.add(r.due), zero);
    sections = [{ title: "Depreciation schedule", rows: [...rows.map(r => ({ label: `${r.asset.assetCode}  ${r.asset.name}`, detail: `Monthly ${amount(new Prisma.Decimal(r.schedule.monthlyDepreciation))} | Posted ${amount(new Prisma.Decimal(r.actualAccumulated))}`, amount: `Due ${amount(new Prisma.Decimal(r.due))}` })), { label: "Total unposted depreciation", amount: amount(due), strong: true }] }];
  } else if (type === "receivables" || type === "payables") {
    title = type === "receivables" ? "Aged Receivables" : "Aged Payables"; subtitle = `As at ${formatDate(asOf)}`;
    const rows = type === "receivables" ? await agedReceivables(active.id, asOf) : await agedPayables(active.id, asOf);
    sections = [{ title: type === "receivables" ? "Customer balances" : "Supplier balances", rows: [...rows.map((row) => ({ label: `${row.reference}  ${row.party}`, detail: `${formatDate(row.due)}  ${row.bucket}`, amount: amount(row.outstanding) })), { label: "Total outstanding", amount: amount(rows.reduce((sum, row) => sum.add(row.outstanding), zero)), strong: true }] }];
  } else if (type === "inventory") {
    title = "Inventory Valuation"; subtitle = `As at ${formatDate(asOf)}`;
    const rows = await inventoryValuation(active.id, asOf);
    sections = [{ title: "Inventory", rows: [...rows.map((row) => ({ label: `${row.sku}  ${row.item}`, detail: `${row.location}  Qty ${Number(row.quantity).toFixed(4)}`, amount: amount(row.value) })), { label: "Total inventory value", amount: amount(rows.reduce((sum, row) => sum.add(row.value), zero)), strong: true }] }];
  } else if (type === "employee-summary") {
    title = "Employee Summary"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)} | Posted payroll and opening YTD`;
    const entries = await payrollEntriesForPeriod(active.id, from, asOf), rows = employeePayrollSummary(entries), totals = payrollReportTotals(entries);
    sections = [{ title: "Employees", rows: [...rows.map(row => ({ label: `${row.employeeNumber}  ${row.fullName}`, detail: `${row.runs} pay ${row.runs === 1 ? "entry" : "entries"} | SPK ${amount(row.employeeSpk)}`, amount: amount(row.net) })), { label: "Gross pay", amount: amount(totals.gross), strong: true }, { label: "Employee SPK", amount: amount(totals.employeeSpk), strong: true }, { label: "Other deductions", amount: amount(totals.deductions), strong: true }, { label: "Employer SPK", amount: amount(totals.employerSpk), strong: true }, { label: "Net pay", amount: amount(totals.net), strong: true }] }];
  } else if (type === "payroll-summary") {
    title = "Payroll Run Summary"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)} | Posted payroll and opening YTD`;
    const entries = await payrollEntriesForPeriod(active.id, from, asOf), totals = payrollReportTotals(entries);
    sections = [{ title: "Payroll entries", rows: [...entries.map(entry => ({ label: `${formatDate(entry.reportDate)}  ${entry.reportReference}`, detail: `${entry.employee.employeeNumber}  ${entry.employee.fullName} | ${entry.reportType}`, amount: amount(payrollEntryGross(entry)) })), { label: "Gross pay", amount: amount(totals.gross), strong: true }, { label: "Employee SPK", amount: amount(totals.employeeSpk), strong: true }, { label: "Other deductions", amount: amount(totals.deductions), strong: true }, { label: "Employer SPK", amount: amount(totals.employerSpk), strong: true }, { label: "Net pay", amount: amount(totals.net), strong: true }] }];
  } else if (type === "employee-statement") {
    const employeeId = url.searchParams.get("employeeId"), allEntries = await payrollEntriesForPeriod(active.id, from, asOf), entries = allEntries.filter(entry => entry.employeeId === employeeId), employee = entries[0]?.employee;
    if (!employee) return new Response("Employee payroll statement not found", { status: 404 });
    const totals = payrollReportTotals(entries); title = "Employee Statement"; subtitle = `${employee.employeeNumber} ${employee.fullName} | ${formatDate(from)} to ${formatDate(asOf)}`;
    sections = [{ title: "Payroll transactions", rows: [...entries.map(entry => ({ label: `${formatDate(entry.reportDate)}  ${entry.reportReference}`, detail: `${entry.reportType} | SPK ${amount(entry.employeeSpk)}`, amount: amount(entry.netPay) })), { label: "Gross pay", amount: amount(totals.gross), strong: true }, { label: "Employee SPK", amount: amount(totals.employeeSpk), strong: true }, { label: "Other deductions", amount: amount(totals.deductions), strong: true }, { label: "Net pay", amount: amount(totals.net), strong: true }] }];
  } else if (type === "payslip-totals") {
    const rows = payslipItemSummary(await payrollEntriesForPeriod(active.id, from, asOf)); title = "Payslip Totals by Item and Employee"; subtitle = `For the period ${formatDate(from)} to ${formatDate(asOf)} | Posted payroll and opening YTD`;
    sections = rows.map(row => ({ title: `${row.employeeNumber}  ${row.fullName}`, rows: [{ label: "Basic pay", amount: amount(row.basicPay) }, { label: "Overtime", amount: amount(row.overtime) }, { label: "Allowances", amount: amount(row.allowances) }, { label: "Bonuses", amount: amount(row.bonuses) }, { label: "Unused leave payout", amount: amount(row.leavePayout) }, { label: "Gratuity / severance", amount: amount(row.gratuity) }, { label: "Other earnings", amount: amount(row.otherEarnings) }, { label: "Employee SPK", amount: amount(row.employeeSpk) }, { label: "Other deductions", amount: amount(row.otherDeductions) }, { label: "Employer SPK", amount: amount(row.employerSpk) }, { label: "Net pay", amount: amount(row.netPay), strong: true }] }));
  } else return new Response("Report not found", { status: 404 });

  const pdf = generateReportPdf({ company: active.legalName, title, subtitle, sections });
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${type}-${asOf.toISOString().slice(0, 10)}.pdf"`, "Cache-Control": "private, no-store" } });
}
