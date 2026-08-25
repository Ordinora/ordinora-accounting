import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { updatePeriod } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const period = await db.accountingPeriod.findFirst({ where: { id, tenantId: active.id }, include: { _count: { select: { journals: true, reports: true, payrollRuns: true, salesInvoices: true, supplierBills: true, salesCreditNotes: true, supplierCreditNotes: true, customerReceipts: true, supplierPayments: true, dailyCashRegisters: true, inventoryOperations: true } } } });
  if (!period) notFound();
  const used = Object.values(period._count).some((count) => count > 0);
  return (
    <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Edit accounting period" pageDescription="Safely update an unused posting period">
      <main className="module-page form-page">
        <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>{period.name}</h2><p>{used ? "This period contains activity, so only its name can be changed." : "This unused period’s name and dates can be changed."}</p></div></header>
        <form action={updatePeriod} className="form-panel">
          <input type="hidden" name="periodId" value={period.id} />
          <section className="form-section"><div className="form-grid">
            <label>Period name<input name="name" defaultValue={period.name} required /></label>
            <label>Start date<input name="startsOn" type="date" defaultValue={period.startsOn.toISOString().slice(0, 10)} readOnly={used} required /></label>
            <label>End date<input name="endsOn" type="date" defaultValue={period.endsOn.toISOString().slice(0, 10)} readOnly={used} required /></label>
          </div></section>
          <div className="form-actions"><Link href="/settings/periods" className="button-secondary">Cancel</Link><button className="button-primary">Save period</button></div>
        </form>
      </main>
    </AppShell>
  );
}
