export type NavigationModule = {
  key: string;
  label: string;
  description: string;
  links: { label: string; href: string; description: string }[];
};

import { canAccessAdministrationFeature, canAccessModule } from "@/lib/staff-access";

export const navigationModules: NavigationModule[] = [
  { key: "automation", label: "AI Accounting", description: "Document capture and assisted bookkeeping.", links: [
    { label: "Processing centre", href: "/automation", description: "Upload and review accounting documents." },
  ] },
  { key: "sales", label: "Sales", description: "Customers, invoices, credits, and daily sales.", links: [
    { label: "Customers", href: "/customers", description: "Maintain customer accounts and details." },
    { label: "Sales quotations", href: "/sales/quotations", description: "Prepare quotes and convert accepted offers to invoices." },
    { label: "Sales orders", href: "/sales/orders", description: "Track confirmed customer orders before invoicing." },
    { label: "Sales invoices", href: "/sales", description: "Create and manage customer invoices." },
    { label: "Receipts", href: "/receipts", description: "Record money received from customers." },
    { label: "Daily sales", href: "/cash-sales", description: "Post daily sales by cash, card, bank transfer, or other tender." },
    { label: "Sales credit notes", href: "/sales/credit-notes", description: "Credit items from an original sales invoice." },
  ] },
  { key: "purchases", label: "Purchases", description: "Suppliers, bills, and supplier credits.", links: [
    { label: "Suppliers", href: "/suppliers", description: "Maintain supplier accounts and details." },
    { label: "Supplier quotations", href: "/purchases/quotations", description: "Compare supplier offers for the same requirement." },
    { label: "Purchase orders", href: "/purchases/orders", description: "Approve purchases and track receipt before billing." },
    { label: "Purchase invoices", href: "/purchases", description: "Record and manage supplier invoices." },
    { label: "Payments", href: "/payments", description: "Record direct payments and settle supplier invoices." },
    { label: "Supplier credit notes", href: "/purchases/credit-notes", description: "Credit items from an original purchase invoice." },
  ] },
  { key: "banking", label: "Banking & cash", description: "Cash movements, statements, and reconciliation.", links: [
    { label: "Bank & cash accounts", href: "/banking", description: "Review bank, cash, and petty-cash accounts." },
    { label: "Bank reconciliations", href: "/reconciliations", description: "Match the ledger with bank statements." },
    { label: "Statement imports", href: "/banking/imports", description: "Import and review bank statement transactions." },
    { label: "Inter-account transfers", href: "/transfers", description: "Move money between bank and cash accounts." },
  ] },
  { key: "accounting", label: "Accounting", description: "General ledger structure and manual journals.", links: [
    { label: "Chart of accounts", href: "/accounts", description: "Maintain ledger accounts and classifications." },
    { label: "Journal entries", href: "/journals", description: "View and post balanced journal entries." },
    { label: "Month-end review", href: "/accounting/month-end", description: "Reconcile control accounts and resolve exceptions before closing a period." },
  ] },
  { key: "inventory", label: "Inventory", description: "Items, locations, quantities, and costing.", links: [
    { label: "Inventory register", href: "/inventory", description: "Review items, locations, quantities, and values." },
    { label: "Inventory movements", href: "/inventory/movements", description: "Review purchases, sales, transfers, and adjustments." },
    { label: "Monthly inventory consumption", href: "/inventory/consumption", description: "Enter or import physical closing stock and post weighted-average COGS." },
    { label: "New stock transfer", href: "/inventory/transfers/new", description: "Transfer inventory between stock locations." },
    { label: "New stock adjustment", href: "/inventory/adjustments/new", description: "Record write-offs and quantity corrections." },
  ] },
  { key: "fixed-assets", label: "Fixed assets", description: "Asset register, depreciation, and disposals.", links: [
    { label: "Asset register", href: "/fixed-assets", description: "Review registered assets and book values." },
    { label: "New asset", href: "/fixed-assets/new", description: "Register a purchased or opening fixed asset." },
    { label: "Import opening assets", href: "/fixed-assets/import", description: "Bulk-register assets owned before bookkeeping began." },
    { label: "Asset reconciliation", href: "/fixed-assets/reconciliation", description: "Compare the asset register with general-ledger controls." },
    { label: "Depreciation run", href: "/fixed-assets/depreciation", description: "Calculate and post periodic depreciation." },
    { label: "Asset disposals", href: "/fixed-assets/disposals", description: "Record asset sales and disposals." },
  ] },
  { key: "reports", label: "Reports", description: "Financial, operational, and published reports.", links: [
    { label: "Report centre", href: "/reports", description: "Open the complete financial report library." },
    { label: "Published reports", href: "/reports/published", description: "Manage report versions published to clients." },
  ] },
  { key: "payroll", label: "Payroll", description: "Employees, payroll runs, final pay, and settlements.", links: [
    { label: "Payroll workspace", href: "/payroll", description: "Review payroll runs and processing status." },
    { label: "Employee register", href: "/payroll/employees", description: "View and update existing employee records." },
    { label: "Prepare payroll", href: "/payroll/runs/new", description: "Calculate a regular payroll run." },
    { label: "Prepare final pay", href: "/payroll/final-pay/new", description: "Prepare a reviewed employee termination settlement." },
    { label: "New employee", href: "/payroll/employees/new", description: "Create a new employee record." },
  ] },
  { key: "tax", label: "Tax & compliance", description: "Tax working years, reminders, and allowances.", links: [
    { label: "Tax workspace", href: "/tax", description: "Manage tax years and compliance deadlines." },
    { label: "Capital allowances", href: "/tax/capital-allowances", description: "Maintain tax capital-allowance calculations." },
  ] },
  { key: "administration", label: "Administration", description: "Company, period, currency, and portal settings.", links: [
    { label: "Companies", href: "/settings/companies", description: "Create and manage client companies." },
    { label: "Accounting staff", href: "/settings/staff", description: "Create staff accounts and limit them to assigned companies." },
    { label: "Opening balances", href: "/settings/opening-balances", description: "Post the opening general-ledger position." },
    { label: "Opening receivables & payables", href: "/settings/opening-subledgers", description: "Allocate opening balances to customers and suppliers." },
    { label: "Accounting periods", href: "/settings/periods", description: "Create, open, close, and edit financial periods." },
    { label: "Currency settings", href: "/settings/currencies", description: "Configure base and foreign currencies." },
    { label: "Client portal", href: "/settings/portal", description: "Control client access and live-report permissions." },
    { label: "Portal documents", href: "/settings/portal/documents", description: "Review documents supplied by clients." },
    { label: "Client questions", href: "/settings/portal/questions", description: "Respond to client accounting questions." },
    { label: "Active sessions", href: "/settings/security/sessions", description: "Review and revoke staff or client sessions." },
    { label: "Multi-factor authentication", href: "/settings/security/mfa", description: "Protect your staff account with an authenticator app." },
  ] },
];

export function navigationModulesForRole(role: string | null | undefined) {
  return navigationModules
    .filter((module) => canAccessModule(role, module.key))
    .map((module) => module.key !== "administration" ? module : {
      ...module,
      links: module.links.filter((link) => {
        const feature = administrationFeatureForHref(link.href);
        return feature ? canAccessAdministrationFeature(role, feature) : false;
      }),
    });
}

function administrationFeatureForHref(href: string) {
  const features: Record<string, string> = {
    "/settings/companies": "companies",
    "/settings/staff": "staff",
    "/settings/opening-balances": "opening-balances",
    "/settings/opening-subledgers": "opening-subledgers",
    "/settings/periods": "periods",
    "/settings/currencies": "currencies",
    "/settings/portal": "client-portal",
    "/settings/portal/documents": "portal-documents",
    "/settings/portal/questions": "client-questions",
    "/settings/security/sessions": "active-sessions",
    "/settings/security/mfa": "mfa",
  };
  return features[href];
}
