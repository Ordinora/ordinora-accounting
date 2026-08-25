import Link from "next/link";
import { Plus } from "lucide-react";
import { AccountRegisterTable } from "@/components/account-register-table";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const accounts = await db.account.findMany({
    where: { tenantId: active.id },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true, reportingClassification: true, isActive: true },
  });
  const canManage = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole ?? "");

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Chart of Accounts" pageDescription="Ledger structure and financial-report classifications">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Account register</h2><p>Brunei-oriented accounts available for postings and financial reports.</p></div>{canManage && <Link href="/accounts/new" className="button-primary"><Plus size={16} />New account</Link>}</header>
      <AccountRegisterTable accounts={accounts} canManage={canManage} currency={active.defaultCurrency} />
    </main>
  </AppShell>;
}
