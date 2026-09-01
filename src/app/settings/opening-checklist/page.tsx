import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleMinus, CircleOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { assertOpeningPayrollRole } from "@/lib/opening-payroll";
import { openingSetupReview } from "@/lib/opening-setup-review";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
const labels = { COMPLETE: "Complete", PARTIAL: "Partially complete", NOT_STARTED: "Not started", NOT_APPLICABLE: "Not applicable" } as const;

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  assertOpeningPayrollRole(user.staffRole);
  const review = await openingSetupReview(active.id);
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Client Setup" pageDescription="Track opening accounting data before regular month-end work begins">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Opening balance checklist</h2><p>Automatically derived from posted journals and supporting registers; no manual completion boxes are required.</p></div></header>
      <div className={`form-notice ${review.complete ? "month-end-ready" : "month-end-alert"}`}><strong>{review.complete ? "Opening setup is complete" : "Opening setup work remains"}</strong><span>{review.complete ? "Every applicable opening-data register is ready for ongoing accounting." : "Complete the outstanding steps before the first month-end review."}</span></div>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Status</th><th>Opening-data area</th><th>Derived check</th><th /></tr></thead><tbody>{review.items.map((item) => { const Icon = item.status === "COMPLETE" ? CheckCircle2 : item.status === "PARTIAL" ? CircleMinus : item.status === "NOT_APPLICABLE" ? CircleOff : CircleDashed; return <tr key={item.key}><td><span className={`status-badge ${item.status === "COMPLETE" ? "active" : item.status === "PARTIAL" ? "pending" : item.status === "NOT_APPLICABLE" ? "inactive" : "warning"}`}><Icon size={13} />{labels[item.status]}</span></td><td><strong>{item.label}</strong></td><td>{item.detail}</td><td><Link href={item.href} className="record-link">Review</Link></td></tr>; })}</tbody></table></div></section>
    </main>
  </AppShell>;
}
