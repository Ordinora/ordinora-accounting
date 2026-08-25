import { createSalesQuotation } from "@/app/sales/quotations/actions";
import { AppShell } from "@/components/app-shell";
import { SalesQuotationForm } from "@/components/sales-quotation-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export default async function NewSalesQuotationPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const [customers, accounts, items, locations] = await Promise.all([
    db.customer.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { name: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "REVENUE" }, orderBy: { code: "asc" } }),
    db.inventoryItem.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { sku: "asc" } }),
    db.inventoryLocation.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
  ]);
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") || "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Sales Quotation" pageDescription="Prepare a non-ledger customer offer"><main className="module-page form-page"><SalesQuotationForm action={createSalesQuotation} customers={customers} accounts={accounts} items={items} locations={locations} /></main></AppShell>;
}
