import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Boxes, Building2, Landmark, Scale, Users, WalletCards, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

type Report = { href: string; name: string; copy: string };
type ReportSection = { name: string; copy: string; Icon: LucideIcon; reports: Report[] };

const sections: ReportSection[] = [
  { name: "Financial statements", copy: "Core performance and financial-position reports.", Icon: BarChart3, reports: [
    { href: "/reports/profit-loss", name: "Profit & Loss", copy: "Revenue, expenses, and net profit for a selected period." },
    { href: "/reports/income-statement", name: "Income Statement", copy: "Income, expenses, and profit for a selected reporting period." },
    { href: "/reports/revenue-statement", name: "Revenue Statement", copy: "Multi-step revenue, gross-profit, expenses, other income, and net income." },
    { href: "/reports/balance-sheet", name: "Balance Sheet", copy: "Assets, liabilities, equity, and current earnings." },
    { href: "/reports/cash-flow", name: "Cash Flow Statement", copy: "Operating, investing, and financing cash movements." },
    { href: "/reports/changes-in-equity", name: "Statement of Changes in Equity", copy: "Opening equity, owner movements, profit, and closing equity." },
  ] },
  { name: "General ledger", copy: "Account balances and detailed posted activity.", Icon: BookOpen, reports: [
    { href: "/reports/trial-balance", name: "Trial Balance", copy: "Posted debit and credit balances by ledger account." },
    { href: "/reports/general-ledger-summary", name: "General Ledger Summary", copy: "Opening, movement, and closing balances by account." },
    { href: "/reports/general-ledger-transactions", name: "General Ledger Transactions", copy: "Detailed journals and running balances by account." },
  ] },
  { name: "Banking & cash", copy: "Cash movement and account-level summaries.", Icon: Landmark, reports: [
    { href: "/reports/receipts-payments-summary", name: "Receipts & Payments Summary", copy: "Cash and bank inflows and outflows by source." },
    { href: "/reports/bank-account-summary", name: "Bank Account Summary", copy: "Opening, receipts, payments, and closing balances." },
  ] },
  { name: "Customers & sales", copy: "Receivables, statements, and sales analysis.", Icon: Users, reports: [
    { href: "/reports/receivables", name: "Aged Receivables", copy: "Outstanding customer invoices by overdue bucket." },
    { href: "/reports/customer-summary", name: "Customer Summary", copy: "Invoices, credit notes, receipts, and balances." },
    { href: "/reports/customer-statement", name: "Customer Statement", copy: "Customer transactions and running receivable balance." },
    { href: "/reports/sales-by-customer", name: "Sales Invoice Totals by Customer", copy: "Gross invoices, credits, and net sales by customer." },
    { href: "/reports/sales-by-item", name: "Sales Invoice Totals by Item", copy: "Invoice quantities and values by item or description." },
  ] },
  { name: "Suppliers & purchases", copy: "Payables and supplier transaction analysis.", Icon: Building2, reports: [
    { href: "/reports/payables", name: "Aged Payables", copy: "Outstanding supplier bills by overdue bucket." },
    { href: "/reports/supplier-summary", name: "Supplier Summary", copy: "Bills, debit notes, payments, and balances." },
    { href: "/reports/supplier-statement", name: "Supplier Statement", copy: "Supplier transactions and running payable balance." },
  ] },
  { name: "Inventory", copy: "Stock quantities, costing, value, and margins.", Icon: Boxes, reports: [
    { href: "/reports/inventory", name: "Inventory Valuation", copy: "Quantity and weighted cost by item and location." },
    { href: "/reports/inventory-quantity-summary", name: "Inventory Quantity Summary", copy: "Quantity, average cost, and value by item." },
    { href: "/reports/inventory-quantity-by-location", name: "Inventory Quantity by Location", copy: "Stock quantity and value by branch and location." },
    { href: "/reports/inventory-profit-margin", name: "Inventory Profit Margin", copy: "Sales, COGS, gross profit, and margin." },
    { href: "/reports/inventory-costing-worksheet", name: "Inventory Costing Worksheet", copy: "Opening stock, purchases, COGS, and closing cost." },
  ] },
  { name: "Fixed assets", copy: "Asset values and depreciation calculations.", Icon: Scale, reports: [
    { href: "/reports/fixed-assets", name: "Fixed Asset Summary", copy: "Cost, accumulated depreciation, and net book value." },
    { href: "/reports/depreciation-worksheet", name: "Depreciation Calculation Worksheet", copy: "Scheduled depreciation compared with posted amounts." },
  ] },
  { name: "Payroll & employees", copy: "Employee earnings, deductions, and payroll runs.", Icon: WalletCards, reports: [
    { href: "/reports/employee-summary", name: "Employee Summary", copy: "Gross pay, deductions, SPK, and net pay by employee." },
    { href: "/reports/employee-statement", name: "Employee Statement", copy: "Payroll transactions and totals for one employee." },
    { href: "/reports/payroll-summary", name: "Payroll Run Summary", copy: "Posted regular and final-pay entries by period." },
    { href: "/reports/payslip-totals", name: "Payslip Totals by Item and Employee", copy: "Detailed earnings, deductions, and SPK totals." },
  ] },
];

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const totalReports = sections.reduce((total, section) => total + section.reports.length, 0);
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Reports" pageDescription="Live financial and operational reports from posted data">
    <main className="module-page">
      <header className="module-header">
        <div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Report centre</h2><p>Choose a report section. All figures are generated from posted entries and displayed in {active.defaultCurrency}.</p></div>
        <div className="report-library-count"><strong>{totalReports}</strong><span>available reports</span></div>
      </header>
      <div className="report-section-grid">
        {sections.map(({ name, copy, Icon, reports }) => <section className="surface-card report-section" key={name}>
          <header className="report-section-header"><span className="report-section-icon"><Icon size={21} /></span><div><h3>{name}</h3><p>{copy}</p></div><span className="report-section-count">{reports.length}</span></header>
          <div className="report-section-links">{reports.map((report) => <Link href={report.href} className="report-row" key={report.href}><span><strong>{report.name}</strong><small>{report.copy}</small></span><ArrowRight size={17} /></Link>)}</div>
        </section>)}
      </div>
    </main>
  </AppShell>;
}
