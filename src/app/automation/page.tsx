import Link from "next/link";
import { AlertTriangle, Bot, Files, ScanSearch, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const documents = await db.accountingDocument.findMany({ where: { tenantId: active.id }, include: { document: true, suggestions: true, duplicateOf: { include: { document: true } }, jobs: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 100 });
  const awaiting = documents.filter((item) => item.status === "REVIEW_REQUIRED").length;
  const duplicates = documents.filter((item) => item.duplicateOfId).length;
  const failures = documents.filter((item) => item.status === "FAILED").length;
  const lowConfidence = documents.filter((item) => item.classificationConfidence && Number(item.classificationConfidence) < 0.8).length;
  const provider = (process.env.DOCUMENT_AI_PROVIDER || (process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ? "azure" : process.env.OPENAI_API_KEY ? "openai" : "mock")).toLowerCase();
  const providerMessage = provider === "azure"
    ? (process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ? "Azure Document Intelligence extraction is active. F0 reads up to two pages per request." : "Azure extraction is selected but needs its endpoint and key before documents can be read.")
    : provider === "openai" ? "Real AI extraction is active. Review every result before confirmation." : "Demo extraction is active. Configure Azure Document Intelligence to enable real document reading.";
  return (
    <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="AI Accounting Centre" pageDescription="Document extraction, validation, matching, and human review">
      <main className="module-page">
        <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Document intelligence</h2><p>AI extracts and suggests. A human must confirm before anything reaches the accounting system.</p></div></header>
        <section className="kpi-grid"><article className="kpi-card"><div className="kpi-label"><span>Awaiting review</span><ScanSearch size={18} /></div><strong>{awaiting}</strong><p>Human confirmation required</p></article><article className="kpi-card"><div className="kpi-label"><span>Low confidence</span><ShieldAlert size={18} /></div><strong>{lowConfidence}</strong><p>Fields need attention</p></article><article className="kpi-card"><div className="kpi-label"><span>Possible duplicates</span><Files size={18} /></div><strong>{duplicates}</strong><p>Never created silently</p></article><article className="kpi-card"><div className="kpi-label"><span>Processing errors</span><AlertTriangle size={18} /></div><strong>{failures}</strong><p>Retry or enter manually</p></article></section>
        <div className="split-layout automation-layout">
          <section className="surface-card table-card">
            <div className="card-header"><div><h3>Processing queue</h3><p>Raw extraction, suggestions, and human-confirmed data are stored separately.</p></div></div>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Document</th><th>Detected type</th><th>Confidence</th><th>Status</th><th>Duplicate</th><th>Uploaded</th></tr></thead><tbody>
              {documents.map((item) => <tr key={item.id}><td><Link href={`/automation/${item.id}`} className="record-link">{item.document.originalName}</Link></td><td>{(item.confirmedType ?? item.detectedType ?? item.requestedType ?? "PENDING").replaceAll("_", " ")}</td><td>{item.classificationConfidence ? `${Math.round(Number(item.classificationConfidence) * 100)}%` : "—"}</td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span></td><td>{item.duplicateOf ? <span className="status-badge overdue">POSSIBLE</span> : "—"}</td><td>{item.createdAt.toLocaleString("en-GB")}</td></tr>)}
              {!documents.length && <tr><td colSpan={6} className="table-empty">Upload the first accounting document to begin the review workflow.</td></tr>}
            </tbody></table></div>
          </section>
          <section className="surface-card compact-form"><div className="card-header"><div><h3><Bot size={16} /> Process document</h3><p>{providerMessage}</p></div></div><DocumentUploadForm /></section>
        </div>
      </main>
    </AppShell>
  );
}
