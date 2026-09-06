import Link from "next/link";
import { ClientDocumentUploadForm } from "@/components/client-document-upload-form";
import { clientDocumentStatus } from "@/lib/document-workflow";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsPage() {
  const user = await requireClient();
  const tenant = user.tenant!;
  const documents = await db.document.findMany({ where: { tenantId: tenant.id, uploadedById: user.id }, orderBy: { createdAt: "desc" } });
  return <main className="portal-page"><header className="portal-header"><div><strong>Ordinora</strong><span>Client Portal</span></div><Link href="/portal" className="button-secondary">Back to dashboard</Link></header><section className="portal-content"><header className="module-header"><div><p className="eyebrow">{tenant.legalName.toUpperCase()}</p><h2>Documents</h2><p>Send source documents securely and follow their processing progress.</p></div></header>{tenant.documentUploadEnabled ? <section className="surface-card compact-form client-upload-card"><div className="card-header"><div><h3>Upload document</h3><p>Files are quarantined and checked before release. Uploading never posts a transaction automatically.</p></div></div><ClientDocumentUploadForm/></section> : <div className="form-notice"><span>Document uploads are currently disabled. Contact your accountant if you need access.</span></div>}<section className="surface-card table-card portal-report-list"><div className="card-header"><div><h3>Your uploads</h3><p>Received means your accountant has the document; Posted includes the recorded transaction reference.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Document</th><th>Size</th><th>Processing status</th><th>Accountant note</th><th>Uploaded</th><th></th></tr></thead><tbody>{documents.map((document) => {
    const blocked = ["SCAN_PENDING", "QUARANTINED"].includes(document.status);
    const visibleStatus = clientDocumentStatus(document.status, document.workflowStatus);
    return <tr key={document.id}><td><strong>{document.originalName}</strong><small className="report-row-detail">{document.contentType}</small></td><td>{(document.sizeBytes / 1024).toFixed(1)} KB</td><td><span className={`status-badge ${visibleStatus.toLowerCase().replaceAll(" ", "_")}`}>{visibleStatus}</span>{document.workflowReference && <small className="report-row-detail">Reference: {document.workflowReference}</small>}</td><td>{document.workflowNote ?? "—"}</td><td>{document.createdAt.toLocaleString("en-BN")}</td><td>{!blocked && <a className="table-action" href={`/portal/documents/${document.id}/download`}>Download</a>}</td></tr>;
  })}{!documents.length && <tr><td colSpan={6} className="table-empty">You have not uploaded any documents.</td></tr>}</tbody></table></div></section></section></main>;
}
