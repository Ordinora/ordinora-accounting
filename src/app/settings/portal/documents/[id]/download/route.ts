import { db } from "@/lib/db";
import { readDocument } from "@/lib/document-store";
import { requireActiveTenant } from "@/lib/session";
import { assertCanAccessAdministrationFeature } from "@/lib/staff-access";

const blockedStatuses = ["SCAN_PENDING", "QUARANTINED", "REJECTED"] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, active } = await requireActiveTenant();
  assertCanAccessAdministrationFeature(user.staffRole, "portal-documents");
  const document = await db.document.findFirst({ where: { id, tenantId: active.id } });
  if (!document) return new Response("Document not found", { status: 404 });
  if (blockedStatuses.includes(document.status as (typeof blockedStatuses)[number])) return new Response("This document is quarantined and cannot be downloaded.", { status: 423 });
  try {
    const bytes = await readDocument(document.storageKey);
    return new Response(bytes, { headers: { "Content-Type": document.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
  } catch {
    return new Response("Stored document is unavailable", { status: 404 });
  }
}
