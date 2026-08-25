import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { changePeriodStatus, createPeriod } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const periods = await db.accountingPeriod.findMany({
    where: { tenantId: active.id },
    include: { _count: { select: { journals: true, reports: true, payrollRuns: true, salesInvoices: true, supplierBills: true, salesCreditNotes: true, supplierCreditNotes: true, customerReceipts: true, supplierPayments: true, dailyCashRegisters: true, inventoryOperations: true } } },
    orderBy: { startsOn: "desc" },
  });
  return (
    <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Accounting periods" pageDescription="Create, close, reopen, and lock posting periods">
      <main className="module-page">
        <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Accounting periods</h2><p>Period controls determine which dates can receive journals and operational postings.</p></div></header>
        <div className="split-layout">
          <section className="surface-card table-card">
            <div className="card-header"><div><h3>Period register</h3><p>Dates cannot be changed after accounting activity has been recorded.</p></div></div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Period</th><th>Start</th><th>End</th><th>Status</th><th className="numeric">Activity</th><th>Actions</th></tr></thead><tbody>
              {periods.map((period) => {
                const activity = Object.values(period._count).reduce((sum, count) => sum + count, 0);
                const admin = ["SYSTEM_ADMIN", "FIRM_ADMIN"].includes(user.staffRole ?? "");
                return <tr key={period.id}><td><strong>{period.name}</strong></td><td>{period.startsOn.toISOString().slice(0, 10)}</td><td>{period.endsOn.toISOString().slice(0, 10)}</td><td><span className={`status-badge ${period.status.toLowerCase()}`}>{period.status}</span></td><td className="numeric">{activity}</td><td><div className="period-actions">{period.status !== "LOCKED" && period.status !== "FINALIZED" && <Link href={`/settings/periods/${period.id}/edit`} className="table-action">Edit</Link>}{period.status === "OPEN" && <form action={changePeriodStatus}><input type="hidden" name="periodId" value={period.id} /><input type="hidden" name="target" value="CLOSED" /><button>Close</button></form>}{period.status === "CLOSED" && <form action={changePeriodStatus}><input type="hidden" name="periodId" value={period.id} /><input type="hidden" name="target" value="OPEN" /><button>Reopen</button></form>}{["OPEN", "CLOSED"].includes(period.status) && <form action={changePeriodStatus}><input type="hidden" name="periodId" value={period.id} /><input type="hidden" name="target" value="LOCKED" /><button>Lock</button></form>}{period.status === "LOCKED" && admin && <form action={changePeriodStatus}><input type="hidden" name="periodId" value={period.id} /><input type="hidden" name="target" value="OPEN" /><button>Admin reopen</button></form>}</div></td></tr>;
              })}
            </tbody></table></div>
          </section>
          <section className="surface-card compact-form">
            <div className="card-header"><div><h3><Plus size={16} /> New period</h3><p>Create the next non-overlapping posting period.</p></div></div>
            <form action={createPeriod} className="compact-form-body">
              <label>Period name<input name="name" placeholder="September 2026" required /></label>
              <label>Start date<input name="startsOn" type="date" required /></label>
              <label>End date<input name="endsOn" type="date" required /></label>
              <button className="button-primary"><CalendarDays size={15} />Create open period</button>
            </form>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
