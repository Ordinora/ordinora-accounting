import { AppShell } from "@/components/app-shell";
import { CashSalesForm } from "@/components/cash-sales-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { postCashSales } from "../actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const [revenueAccounts, cashAccounts, items, locations, priorRegisters] = await Promise.all([
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "REVENUE" }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" }, orderBy: { code: "asc" } }),
    db.inventoryItem.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { sku: "asc" } }),
    db.inventoryLocation.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
    db.dailyCashRegister.findMany({ where: { tenantId: active.id, branchLabel: { not: null } }, select: { branchLabel: true } }),
  ]);
  const branches = [...new Set(["Main branch", ...locations.map(location => location.branchLabel).filter((label): label is string => Boolean(label)), ...priorRegisters.map(register => register.branchLabel).filter((label): label is string => Boolean(label))])].sort();

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Daily Sale" pageDescription="Post cash, card, bank-transfer, or other sales with optional inventory items">
    <main className="module-page form-page"><CashSalesForm action={postCashSales} revenueAccounts={revenueAccounts} cashAccounts={cashAccounts} inventoryItems={items.map(item => ({ id: item.id, code: item.sku, name: item.name, revenueAccountId: item.revenueAccountId }))} inventoryLocations={locations} branches={branches} currency={active.defaultCurrency} /></main>
  </AppShell>;
}
