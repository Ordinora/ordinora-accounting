import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { editManualJournal } from "../../actions";

export const dynamic = "force-dynamic";
export default async function EditJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, { user, tenants, active } = await requireActiveTenant();
  const [journal, accounts] = await Promise.all([db.journal.findFirst({ where: { id, tenantId: active.id }, include: { lines: true } }), db.account.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } })]);
  if (!journal) notFound();
  if (journal.source !== "MANUAL") redirect(`/journals/${journal.id}`);
  const debit = journal.lines.find(line => line.debit.gt(0)), credit = journal.lines.find(line => line.credit.gt(0));
  if (!debit || !credit || journal.lines.length !== 2) redirect(`/journals/${journal.id}`);
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={`Edit ${journal.reference}`} pageDescription="Update the transaction and connected ledger reports atomically"><main className="module-page form-page"><div className="form-notice"><strong>Connected update</strong><span>Saving replaces the posting lines and immediately updates the dashboard, ledger, and financial reports.</span></div><form action={editManualJournal} className="form-panel"><input type="hidden" name="journalId" value={journal.id} /><section className="form-section"><div className="section-heading"><h2>Transaction details</h2><p>Changes are recorded in the audit history. The accounting date selects the open period automatically.</p></div><div className="form-grid"><label>Reference <em>*</em><input name="reference" required maxLength={40} defaultValue={journal.reference} /></label><label>Accounting date <em>*</em><input name="accountingDate" type="date" required defaultValue={journal.accountingDate.toISOString().slice(0, 10)} /></label><label className="span-2">Description <em>*</em><input name="description" required maxLength={240} defaultValue={journal.description} /></label></div></section><section className="form-section"><div className="section-heading"><h2>Posting</h2><p>Debit and credit remain balanced automatically.</p></div><div className="posting-grid"><label>Debit account <em>*</em><select name="debitAccountId" required defaultValue={debit.accountId}>{accounts.map(account => <option value={account.id} key={account.id}>{account.code} — {account.name}</option>)}</select></label><label>Credit account <em>*</em><select name="creditAccountId" required defaultValue={credit.accountId}>{accounts.map(account => <option value={account.id} key={account.id}>{account.code} — {account.name}</option>)}</select></label><label>Amount ({active.defaultCurrency}) <em>*</em><input name="amount" required inputMode="decimal" pattern="\d+(\.\d{1,2})?" defaultValue={debit.debit.toFixed(2)} /></label></div><label>Edit reason <em>*</em><input name="reason" required minLength={5} maxLength={240} placeholder="Explain what was corrected" /></label></section><div className="form-actions"><Link href={`/journals/${journal.id}`} className="button-secondary">Cancel</Link><button className="button-primary"><Save size={16} />Save changes</button></div></form></main></AppShell>;
}
