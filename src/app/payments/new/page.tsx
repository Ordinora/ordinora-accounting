import { AppShell } from "@/components/app-shell";
import { PaymentForm } from "@/components/payment-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { createDirectPayment } from "../actions";

export const dynamic = "force-dynamic";
export default async function NewPayment() {
  const { user, tenants, active } = await requireActiveTenant();
  const [bankAccounts, postingAccounts, tenantCurrencies, inventoryItems, inventoryLocations] = await Promise.all([
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, isControlAccount: false }, orderBy: { code: "asc" } }),
    db.tenantCurrency.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
    db.inventoryItem.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { sku: "asc" } }),
    db.inventoryLocation.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
  ]);
  const currencies = [...new Set([active.defaultCurrency, ...tenantCurrencies.map((entry) => entry.code)])];
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Payment" pageDescription="Record expenses, assets, or cash inventory purchases">
    <main className="module-page form-page"><PaymentForm action={createDirectPayment} bankAccounts={bankAccounts} postingAccounts={postingAccounts} currencies={currencies} defaultCurrency={active.defaultCurrency} inventoryItems={inventoryItems.map((item) => ({ id: item.id, code: item.sku, name: item.name, inventoryAccountId: item.inventoryAccountId }))} inventoryLocations={inventoryLocations} /></main>
  </AppShell>;
}
