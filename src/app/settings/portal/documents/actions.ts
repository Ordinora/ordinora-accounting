"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { documentWorkflowStatuses, validateDocumentWorkflowChange } from "@/lib/document-workflow";
import { requireActiveTenantForMutation } from "@/lib/session";
import { assertCanAccessAdministrationFeature } from "@/lib/staff-access";

const workflowSchema = z.object({
  workflowStatus: z.enum(documentWorkflowStatuses),
  workflowReference: z.string().trim().max(120).optional(),
  workflowNote: z.string().trim().max(500).optional(),
});

export async function updateDocumentWorkflow(documentId: string, formData: FormData) {
  try {
    const { user, active } = await requireActiveTenantForMutation();
    assertCanAccessAdministrationFeature(user.staffRole, "portal-documents");
    const input = workflowSchema.parse(Object.fromEntries(formData));
    const document = await db.document.findFirst({ where: { id: documentId, tenantId: active.id } });
    if (!document) throw new Error("Document not found for this company.");
    if (["SCAN_PENDING", "QUARANTINED"].includes(document.status)) throw new Error("Complete the security review before changing the processing status.");
    const update = validateDocumentWorkflowChange({ current: document.workflowStatus, next: input.workflowStatus, reference: input.workflowReference, note: input.workflowNote });
    await db.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id: document.id, tenantId: active.id, workflowStatus: document.workflowStatus },
        data: { ...update, workflowUpdatedAt: new Date(), workflowUpdatedById: user.id },
      });
      if (result.count !== 1) throw new Error("The document status changed in another session. Refresh and try again.");
      await tx.auditEvent.create({
        data: {
          firmId: user.firmId,
          tenantId: active.id,
          actorId: user.id,
          actorKind: "STAFF",
          action: "PORTAL_DOCUMENT_WORKFLOW_UPDATED",
          entityType: "Document",
          entityId: document.id,
          previousValues: { workflowStatus: document.workflowStatus, workflowReference: document.workflowReference, workflowNote: document.workflowNote },
          newValues: update,
        },
      });
    });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "The document status could not be updated.";
    redirect(`/settings/portal/documents?error=${encodeURIComponent(message || "The document status could not be updated.")}`);
  }
  revalidatePath("/settings/portal/documents");
  revalidatePath("/portal/documents");
  redirect("/settings/portal/documents?updated=1");
}
