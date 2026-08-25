import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { OpeningDocumentForm } from "@/components/opening-document-form";
import { db } from "@/lib/db";
import { openingControlBalance } from "@/lib/opening-control";
import { openingControlPosition } from "@/lib/opening-subledgers";
import { requireActiveTenant } from "@/lib/session";
import { deleteOpeningDocument } from "./actions";

export const dynamic = "force-dynamic";
const zero = new Prisma.Decimal(0);
const money = (code: string, value: Prisma.Decimal) => `${code} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const [opening, customers, suppliers, receivables, payables] = await Promise.all([
    db.journal.findFirst({ where: { tenantId: active.id, source: "OPENING_BALANCE", status: "POSTED" }, include: { lines: { include: { account: true } } }, orderBy: { accountingDate: "desc" } }),
    db.customer.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { name: "asc" } }),
    db.salesInvoice.findMany({ where: { tenantId: active.id, isOpeningBalance: true, status: { not: "VOIDED" } }, include: { customer: true, allocations: true }, orderBy: { invoiceDate: "asc" } }),
    db.supplierBill.findMany({ where: { tenantId: active.id, isOpeningBalance: true, status: { not: "VOIDED" } }, include: { supplier: true, allocations: true }, orderBy: { billDate: "asc" } }),
  ]);
  const arTarget = openingControlBalance(opening?.lines, "RECEIVABLE"), apTarget = openingControlBalance(opening?.lines, "PAYABLE");
  const ar = openingControlPosition({ target: arTarget, allocated: receivables.reduce((sum, item) => sum.add(item.baseTotal), zero) });
  const ap = openingControlPosition({ target: apTarget, allocated: payables.reduce((sum, item) => sum.add(item.baseTotal), zero) });
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Opening Receivables & Payables" pageDescription="Allocate control-account balances without duplicating the ledger"><main className="module-page">
    <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Opening subledger allocation</h2><p>These records support ageing and settlements but create no revenue, expense, or general-ledger posting.</p></div></header>
    <section className="kpi-grid"><article className="kpi-card"><small>Receivable control</small><strong>{money(active.defaultCurrency, ar.target)}</strong><p>{ar.complete ? "Fully allocated" : `${money(active.defaultCurrency, ar.remaining)} remaining`}</p></article><article className="kpi-card"><small>Customer invoices allocated</small><strong>{money(active.defaultCurrency, ar.allocated)}</strong><p>{receivables.length} opening documents</p></article><article className="kpi-card"><small>Payable control</small><strong>{money(active.defaultCurrency, ap.target)}</strong><p>{ap.complete ? "Fully allocated" : `${money(active.defaultCurrency, ap.remaining)} remaining`}</p></article><article className="kpi-card"><small>Supplier bills allocated</small><strong>{money(active.defaultCurrency, ap.allocated)}</strong><p>{payables.length} opening documents</p></article></section>
    <div className="split-layout"><DocumentTable title="Opening customer invoices" rows={receivables.map((item) => ({ id: item.id, party: item.customer.name, reference: item.reference, date: item.invoiceDate, due: item.dueDate, amount: item.baseTotal, allocated: item.allocations.length > 0, kind: "RECEIVABLE" as const }))} currency={active.defaultCurrency} /><OpeningDocumentForm kind="RECEIVABLE" parties={customers} currency={active.defaultCurrency} remaining={ar.remaining.toFixed(2)} /></div>
    <div className="split-layout"><DocumentTable title="Opening supplier bills" rows={payables.map((item) => ({ id: item.id, party: item.supplier.name, reference: item.reference, date: item.billDate, due: item.dueDate, amount: item.baseTotal, allocated: item.allocations.length > 0, kind: "PAYABLE" as const }))} currency={active.defaultCurrency} /><OpeningDocumentForm kind="PAYABLE" parties={suppliers} currency={active.defaultCurrency} remaining={ap.remaining.toFixed(2)} /></div>
  </main></AppShell>;
}

function DocumentTable({ title, rows, currency }: { title: string; rows: { id: string; party: string; reference: string; date: Date; due: Date; amount: Prisma.Decimal; allocated: boolean; kind: "RECEIVABLE" | "PAYABLE" }[]; currency: string }) {
  return <section className="surface-card table-card"><div className="card-header"><div><h3>{title}</h3><p>{rows.length} documents</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Party</th><th>Reference</th><th>Date</th><th>Due</th><th className="numeric">Outstanding</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.party}</td><td><strong>{row.reference}</strong></td><td>{row.date.toLocaleDateString("en-BN")}</td><td>{row.due.toLocaleDateString("en-BN")}</td><td className="numeric">{money(currency, row.amount)}</td><td>{!row.allocated && <form action={deleteOpeningDocument}><input type="hidden" name="kind" value={row.kind} /><input type="hidden" name="id" value={row.id} /><button className="table-action">Delete</button></form>}</td></tr>)}{!rows.length && <tr><td colSpan={6} className="table-empty">No opening documents entered.</td></tr>}</tbody></table></div></section>;
}
