export const notificationTypes = {
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  DOCUMENT_QUARANTINED: "DOCUMENT_QUARANTINED",
  CLIENT_ASSIGNED: "CLIENT_ASSIGNED",
  QUESTION_RAISED: "QUESTION_RAISED",
  QUESTION_REPLIED: "QUESTION_REPLIED",
} as const;

export type NotificationType = keyof typeof notificationTypes;

export function newlyAssignedTenantIds(previousTenantIds: string[], nextTenantIds: string[]) {
  const previous = new Set(previousTenantIds);
  return [...new Set(nextTenantIds)].filter((tenantId) => !previous.has(tenantId));
}

export function documentNotificationType(released: boolean): NotificationType {
  return released ? "DOCUMENT_UPLOADED" : "DOCUMENT_QUARANTINED";
}

export function clientMayReceiveQuestionNotification({ clientVisible, internalOnly }: { clientVisible: boolean; internalOnly: boolean }) {
  return clientVisible && !internalOnly;
}
