import Link from "next/link";
import { AlertTriangle, CheckCircle2, LockKeyhole, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { MONTH_END_CHECKLIST } from "@/lib/month-end-checklist";
import { monthEndReview } from "@/lib/month-end-review";
import { requireActiveTenant } from "@/lib/session";
import { updateMonthEndChecklist } from "./actions";

const date = (value: string | undefined) => {
  const parsed = value ? new Date(`${value}T23:59:59.999Z`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};
const money = (currency: string, value?: { toNumber(): number }) => value ? `${currency} ${value.toNumber().toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const q = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  const asOf = date(q.asOf);
  const asOfValue = asOf.toISOString().slice(0, 10);
  const review = await monthEndReview(active.id, asOf);
  const saved = review.period ? await db.monthEndChecklistItem.findMany({
    where: { tenantId: active.id, periodId: review.period.id },
    include: { completedBy: { select: { displayName: true } } },
  }) : [];
  const savedByKey = new Map(saved.map((item) => [item.key, item]));
  const checklistComplete = Boolean(review.period) && MONTH_END_CHECKLIST.every((definition) => savedByKey.get(definition.key)?.completed);
  const closeReady = review.ready && checklistComplete;
  const editable = Boolean(review.period && !["LOCKED", "FINALIZED"].includes(review.period.status));

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Month-end Review" pageDescription="Reconcile control accounts and complete the close checklist">
    <main className="module-page">
      <header className="module-header">
        <div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Month-end accounting review</h2><p>Automated reconciliations and documented accountant confirmations before locking a period.</p></div>
        <form className="report-filter"><label>Review date<input name="asOf" type="date" defaultValue={asOfValue} /></label><button className="button-secondary">Update</button></form>
      </header>
      <div className={`form-notice ${closeReady ? "month-end-ready" : "month-end-alert"}`}>
        <strong>{closeReady ? "Period is ready to lock" : "Month-end work remains"}</strong>
        <span>{closeReady ? "All automated checks pass and every accountant confirmation is complete." : "Resolve warnings or differences and complete every confirmation before locking the period."}</span>
        {closeReady && <Link className="button-important month-end-lock-link" href="/settings/periods"><LockKeyhole size={14} />Manage period lock</Link>}
      </div>
      <section className="surface-card table-card">
        <div className="card-heading"><div><h3>Automated close checks</h3><p>As at {asOf.toLocaleDateString("en-BN")}; warnings prevent close readiness until resolved.</p></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Status</th><th>Control</th><th className="numeric">Ledger</th><th className="numeric">Supporting register</th><th className="numeric">Difference</th><th>Review note</th><th></th></tr></thead><tbody>{review.checks.map((check) => {
          const Icon = check.status === "PASS" ? CheckCircle2 : check.status === "WARNING" ? AlertTriangle : XCircle;
          return <tr key={check.key}><td><span className={`status-badge ${check.status.toLowerCase()}`}><Icon size={13} />{check.status}</span></td><td><strong>{check.label}</strong></td><td className="numeric">{money(active.defaultCurrency, check.ledger)}</td><td className="numeric">{money(active.defaultCurrency, check.supporting)}</td><td className="numeric">{money(active.defaultCurrency, check.difference)}</td><td>{check.detail}</td><td><Link href={check.href} className="record-link">Review</Link></td></tr>;
        })}</tbody></table></div>
      </section>
      <section className="surface-card month-end-checklist-card">
        <div className="card-heading"><div><h3>Accountant close checklist</h3><p>{review.period ? `${review.period.name} · ${review.period.status}` : "Select a date inside an accounting period to record confirmations."}</p></div></div>
        <div className="month-end-checklist">{MONTH_END_CHECKLIST.map((definition) => {
          const item = savedByKey.get(definition.key);
          return <form action={updateMonthEndChecklist} className="month-end-check-row" key={definition.key}>
            <input type="hidden" name="periodId" value={review.period?.id ?? ""} /><input type="hidden" name="key" value={definition.key} /><input type="hidden" name="asOf" value={asOfValue} />
            <label className="month-end-check-toggle"><input type="checkbox" name="completed" value="true" defaultChecked={item?.completed ?? false} disabled={!editable} /><span><strong>{definition.label}</strong><small>{definition.guidance}</small>{item?.completedAt && <small>Completed by {item.completedBy?.displayName ?? "staff user"} on {item.completedAt.toLocaleString("en-BN")}</small>}</span></label>
            <label className="month-end-note"><span>Review note</span><input name="notes" maxLength={500} defaultValue={item?.notes ?? ""} placeholder="Optional evidence or explanation" disabled={!editable} /></label>
            <button className="button-secondary" disabled={!editable || !review.period}>Save</button>
          </form>;
        })}</div>
      </section>
    </main>
  </AppShell>;
}
