import { AppShell } from "@/components/app-shell";
import { TransferForm } from "@/components/transfer-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { createTransfer } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page() { const { user, tenants, active } = await requireActiveTenant(); const [accounts, tenantCurrencies] = await Promise.all([db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" }, orderBy: { code: "asc" } }), db.tenantCurrency.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } })]); const currencies = [...new Set([active.defaultCurrency, ...tenantCurrencies.map((item) => item.code)])]; return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Inter-Account Transfer" pageDescription="Move money without recording income or expense"><main className="module-page form-page"><TransferForm action={createTransfer} accounts={accounts} currencies={currencies} defaultCurrency={active.defaultCurrency} /></main></AppShell>; }
