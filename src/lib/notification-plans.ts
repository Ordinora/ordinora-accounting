import type { NotificationDraft } from "./notifications";
import { clientMayReceiveQuestionNotification, documentNotificationType, newlyAssignedTenantIds } from "./notification-rules";

type Common = { firmId: string; tenantId: string };

export function documentNotificationDrafts(input: Common & { recipientIds: string[]; tenantName: string; actorName: string; documentId: string; filename: string; released: boolean }) {
  const type = documentNotificationType(input.released);
  return [...new Set(input.recipientIds)].map<NotificationDraft>((recipientId) => ({
    firmId: input.firmId, tenantId: input.tenantId, recipientId, type,
    title: input.released ? `New document from ${input.tenantName}` : `Urgent: quarantined document from ${input.tenantName}`,
    body: input.released ? `${input.actorName} uploaded ${input.filename}.` : `${input.filename} failed its security scan and was quarantined. Review the document inbox and scan result.`,
    linkPath: "/settings/portal/documents", relatedEntityType: "Document", relatedEntityId: input.documentId,
  }));
}

export function clientAssignmentNotificationDrafts(input: { firmId: string; recipientId: string; previousTenantIds: string[]; tenants: { id: string; legalName: string }[] }) {
  const added = new Set(newlyAssignedTenantIds(input.previousTenantIds, input.tenants.map((tenant) => tenant.id)));
  return input.tenants.filter((tenant) => added.has(tenant.id)).map<NotificationDraft>((tenant) => ({
    firmId: input.firmId, tenantId: tenant.id, recipientId: input.recipientId, type: "CLIENT_ASSIGNED", title: "New client assigned",
    body: `You have been assigned to ${tenant.legalName}.`, linkPath: "/", relatedEntityType: "Tenant", relatedEntityId: tenant.id,
  }));
}

export function staffQuestionNotificationDrafts(input: Common & { recipientIds: string[]; tenantName: string; questionId: string; subject: string; actorName: string; reply: boolean }) {
  return [...new Set(input.recipientIds)].map<NotificationDraft>((recipientId) => ({
    firmId: input.firmId, tenantId: input.tenantId, recipientId, type: "QUESTION_RAISED",
    title: input.reply ? `Client replied: ${input.subject}` : `New client question: ${input.subject}`,
    body: `${input.actorName} ${input.reply ? "replied to a question" : "asked a question"} for ${input.tenantName}.`,
    linkPath: `/settings/portal/questions/${input.questionId}`, relatedEntityType: "Question", relatedEntityId: input.questionId,
  }));
}

export function clientQuestionNotificationDrafts(input: Common & { recipientIds: string[]; questionId: string; subject: string; actorName: string; clientVisible: boolean; internalOnly: boolean }) {
  if (!clientMayReceiveQuestionNotification(input)) return [];
  return [...new Set(input.recipientIds)].map<NotificationDraft>((recipientId) => ({
    firmId: input.firmId, tenantId: input.tenantId, recipientId, type: "QUESTION_REPLIED", title: `Accountant replied: ${input.subject}`,
    body: `${input.actorName} added a reply to your question.`, linkPath: `/portal/questions/${input.questionId}`, relatedEntityType: "Question", relatedEntityId: input.questionId,
  }));
}
