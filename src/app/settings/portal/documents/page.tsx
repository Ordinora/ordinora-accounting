import { AppShell } from "@/components/app-shell";
import { availableDocumentWorkflowStatuses, clientDocumentStatus } from "@/lib/document-workflow";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { assertCanAccessAdministrationFeature } from "@/lib/staff-access";
import { retryDocumentSecurityScan, updateDocumentWorkflow } from "./actions";

export const dynamic = "force-dynamic";

export default async function PortalDocumentInbox({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string; rescanned?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  assertCanAccessAdministrationFeature(user.staffRole, "portal-documents");
  const documents = await db.document.findMany({ where: { tenantId: active.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const uploaders = await db.user.findMany({ where: { id: { in: [...new Set(documents.map((document) => document.uploadedById))] } }, select: { id: true, displayName: true, kind: true } });
  const names = new Map(uploaders.map((uploader) => [uploader.id, `${uploader.displayName} (${uploader.kind.toLowerCase()})`]));
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Portal Documents" pageDescription="Tenant-isolated files received from client users">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Document inbox</h2><p>Track each client document from receipt to posting. Workflow updates never create accounting entries.</p></div></header>
      {query.error && <div className="form-error" role="alert">{query.error}</div>}
      {query.updated && <div className="form-success" role="status">Document workflow status updated.</div>}
      {query.rescanned && <div className="form-success" role="status">Document passed the security scan and was released to the inbox.</div>}
      <section className="surface-card table-card portal-document-inbox"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Document</th><th>Uploaded by</th><th>Security</th><th>Processing</th><th>Received</th><th>Workflow update</th></tr></thead><tbody>{documents.map((document) => {
        const blocked = ["SCAN_PENDING", "QUARANTINED"].includes(document.status);
        return <tr key={document.id}>
          <td><strong>{document.originalName}</strong><small className="report-row-detail">{(document.sizeBytes / 1024).toFixed(1)} KB · {document.contentType}</small>{!blocked && <a className="table-action" href={`/settings/portal/documents/${document.id}/download`}>Download</a>}</td>
          <td>{names.get(document.uploadedById) ?? "Unknown user"}</td>
          <td><span className={`status-badge ${blocked ? "security_review" : "passed"}`}>{blocked ? document.status.replaceAll("_", " ") : "PASSED"}</span></td>
          <td><span className={`status-badge ${document.workflowStatus.toLowerCase()}`}>{clientDocumentStatus(document.status, document.workflowStatus)}</span>{document.workflowReference && <small className="report-row-detail">Reference: {document.workflowReference}</small>}{document.workflowNote && <small className="report-row-detail">{document.workflowNote}</small>}</td>
          <td>{document.createdAt.toLocaleString("en-BN")}</td>
          <td>{document.status === "QUARANTINED" ? <form action={retryDocumentSecurityScan.bind(null, document.id)}><button className="button-secondary">Retry security scan</button></form> : blocked || document.workflowStatus === "POSTED" ? <small>{blocked ? "Waiting for security clearance" : "Posted workflow completed"}</small> : <form action={updateDocumentWorkflow.bind(null, document.id)} className="document-workflow-form"><select name="workflowStatus" defaultValue="" required><option value="" disabled>Choose next status</option>{availableDocumentWorkflowStatuses(document.workflowStatus).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><input name="workflowReference" maxLength={120} placeholder="Posting reference (required for Posted)"/><input name="workflowNote" maxLength={500} placeholder="Client-visible note / rejection reason"/><button className="button-secondary">Update</button></form>}</td>
        </tr>;
      })}{!documents.length && <tr><td colSpan={6} className="table-empty">No documents have been received.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
