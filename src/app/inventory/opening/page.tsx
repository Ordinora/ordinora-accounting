import { AppShell } from "@/components/app-shell";
import { OpeningInventoryForm } from "@/components/opening-inventory-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { postOpeningInventory } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const [items, locations, offsets] = await Promise.all([
    db.inventoryItem.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { sku: "asc" } }),
    db.inventoryLocation.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: { in: ["EQUITY", "LIABILITY"] } }, orderBy: { code: "asc" } }),
  ]);

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Opening Inventory" pageDescription="Enter opening quantities and values by item and location">
    <main className="module-page form-page">
      <div className="form-notice"><strong>Choose the treatment that matches the general ledger</strong><span>Allocate an existing balance when inventory is already in the opening journal. Create a new journal only when it is not.</span></div>
      <OpeningInventoryForm action={postOpeningInventory} items={items.map(x => ({ id: x.id, label: `${x.sku} — ${x.name}` }))} locations={locations.map(x => ({ id: x.id, label: `${x.code} — ${x.name}` }))} offsetAccounts={offsets.map(x => ({ id: x.id, label: `${x.code} — ${x.name}` }))} currency={active.defaultCurrency} />
    </main>
  </AppShell>;
}
