import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { editReconciliation } from "../../actions";

export const dynamic = "force-dynamic";

const dateInput = (value: Date) => value.toISOString().slice(0, 10);

export default async function EditReconciliationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const [reconciliation, accounts] = await Promise.all([
    db.bankReconciliation.findFirst({ where: { id, tenantId: active.id } }),
    db.account.findMany({
      where: { tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!reconciliation) notFound();
  if (reconciliation.status === "RECONCILED") redirect(`/reconciliations/${reconciliation.id}`);

  return (
    <AppShell
      user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }}
      tenants={tenants}
      activeTenant={active}
      pageTitle={`Edit ${reconciliation.reference}`}
      pageDescription="Correct the draft statement details before completion"
    >
      <main className="module-page form-page">
        <Link href={`/reconciliations/${reconciliation.id}`} className="back-link"><ArrowLeft size={15} />Back to reconciliation</Link>
        <div className="form-notice">
          <strong>Draft record</strong>
          <span>Changing the bank account or statement dates resets saved clearing selections. Completed reconciliations are locked for audit integrity.</span>
        </div>
        <form action={editReconciliation} className="surface-card compact-form-body">
          <input type="hidden" name="reconciliationId" value={reconciliation.id} />
          <div className="card-header">
            <div><h3>Statement details</h3><p>Use the dates and closing balance shown on the bank statement, PDF, paper copy, or online banking screen.</p></div>
          </div>
          <div className="form-grid">
            <label>Bank or cash account
              <select name="accountId" required defaultValue={reconciliation.accountId}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
            <label>Reference<input name="reference" required maxLength={40} defaultValue={reconciliation.reference} /></label>
            <label>Statement start<input type="date" name="statementStart" required defaultValue={dateInput(reconciliation.statementStart)} /></label>
            <label>Statement end<input type="date" name="statementEnd" required defaultValue={dateInput(reconciliation.statementEnd)} /></label>
            <label>Statement closing balance ({active.defaultCurrency})
              <input name="statementClosingBalance" required inputMode="decimal" defaultValue={reconciliation.statementClosingBalance.toFixed(2)} placeholder="0.00 or -500.00" />
            </label>
          </div>
          <div className="form-actions">
            <Link href={`/reconciliations/${reconciliation.id}`} className="button-secondary">Cancel</Link>
            <button className="button-primary"><Save size={15} />Save changes</button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
