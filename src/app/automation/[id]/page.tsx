import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Bot, CheckCircle2, FileText, RotateCcw, XCircle } from "lucide-react";
import { AccountingDocumentType } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { cancelAccountingDocument, confirmAccountingDocument, retryAccountingDocument } from "../actions";

export const dynamic = "force-dynamic";

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const record = await db.accountingDocument.findFirst({ where: { id, tenantId: active.id }, include: { document: true, duplicateOf: { include: { document: true } }, suggestions: { orderBy: { createdAt: "asc" } }, jobs: { orderBy: { createdAt: "desc" } } } });
  if (!record) notFound();
  const extracted = record.extractedData && typeof record.extractedData === "object" && !Array.isArray(record.extractedData) ? record.extractedData as Record<string, unknown> : {};
  const fields = Object.entries(extracted).filter(([key]) => key !== "fieldConfidences");
  const confidences = extracted.fieldConfidences && typeof extracted.fieldConfidences === "object" && !Array.isArray(extracted.fieldConfidences) ? extracted.fieldConfidences as Record<string, unknown> : {};
  const currentType = record.confirmedType ?? record.detectedType ?? record.requestedType ?? "OTHER";

  return (
    <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Document review" pageDescription="Compare the original document, extracted data, and AI suggestions">
      <main className="module-page">
        <div className="detail-toolbar"><Link href="/automation" className="back-link">← Back to AI Accounting Centre</Link><span className={`status-badge large ${record.status.toLowerCase()}`}>{record.status.replaceAll("_", " ")}</span></div>
        <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>{record.document.originalName}</h2><p>{record.document.contentType} · {(record.document.sizeBytes / 1024).toFixed(1)} KB · Provider {record.provider}/{record.model ?? "pending"}</p></div></header>

        {record.duplicateOf && <div className="form-notice duplicate-warning"><AlertTriangle size={20} /><strong>Possible duplicate</strong><span>The same file content was previously uploaded as <Link href={`/automation/${record.duplicateOf.id}`}>{record.duplicateOf.document.originalName}</Link>. Review it before continuing.</span></div>}

        <div className="document-review-grid">
          <section className="surface-card document-original-panel">
            <div className="card-header"><div><h3><FileText size={17} /> Original document</h3><p>Stored privately outside the public website directory.</p></div></div>
            <div className="document-placeholder"><FileText size={42} /><strong>{record.document.originalName}</strong><span>Secure preview and authorized download will be added with the real OCR adapter.</span><small>SHA-256: {record.document.checksum.slice(0, 18)}…</small></div>
          </section>
          <section className="surface-card">
            <div className="card-header"><div><h3><Bot size={17} /> Extracted information</h3><p>Mock values are intentionally low-confidence and require manual verification.</p></div></div>
            <div className="extraction-list">
              {fields.map(([key, value]) => { const confidence = Number(confidences[key] ?? 0); return <div key={key} className={confidence && confidence < 0.75 ? "low-confidence" : ""}><span>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</span><strong>{display(value)}</strong>{confidence > 0 && <small>{Math.round(confidence * 100)}% confidence</small>}</div>; })}
              {!fields.length && <div><span>Extraction</span><strong>No structured data available.</strong></div>}
            </div>
          </section>
        </div>

        <section className="surface-card suggestion-card">
          <div className="card-header"><div><h3>AI bookkeeping suggestions</h3><p>Suggestions do not modify the ledger or chart of accounts.</p></div></div>
          <div className="suggestion-list">{record.suggestions.map((suggestion) => <article key={suggestion.id}><div><strong>{suggestion.suggestionType.replaceAll("_", " ")}</strong><span>{JSON.stringify(suggestion.proposedValue)}</span><p>{suggestion.reason}</p></div><span className={`confidence-chip ${Number(suggestion.confidence) < 0.75 ? "low" : ""}`}>{Math.round(Number(suggestion.confidence) * 100)}%</span></article>)}{!record.suggestions.length && <p className="table-empty">No bookkeeping suggestions are available.</p>}</div>
        </section>

        <section className="surface-card review-decision">
          <div><h3>Human review decision</h3><p>Confirming stores a reviewed copy. It does not create or post any accounting transaction.</p></div>
          <div className="workflow-actions">
            {record.status === "REVIEW_REQUIRED" && <form action={confirmAccountingDocument} className="review-confirm-form"><input type="hidden" name="accountingDocumentId" value={record.id} /><select name="confirmedType" defaultValue={currentType}>{Object.values(AccountingDocumentType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select><button className="button-important"><CheckCircle2 size={15} />Confirm reviewed data</button></form>}
            {["FAILED", "REVIEW_REQUIRED"].includes(record.status) && <form action={retryAccountingDocument}><input type="hidden" name="accountingDocumentId" value={record.id} /><button className="button-secondary"><RotateCcw size={15} />Retry processing</button></form>}
            {!["POSTED", "CANCELLED"].includes(record.status) && <form action={cancelAccountingDocument}><input type="hidden" name="accountingDocumentId" value={record.id} /><button className="button-danger"><XCircle size={15} />Cancel</button></form>}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
