import "server-only";
import { db } from "./db";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "./email";
import type { NotificationType } from "./notification-rules";

export type NotificationDraft = {
  firmId: string;
  tenantId?: string | null;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

type NotificationDependencies = {
  createRecord: (draft: NotificationDraft) => Promise<{ id: string }>;
  recipientEmail: (recipientId: string) => Promise<string | null>;
  updateEmailStatus: (id: string, status: "SENT" | "FAILED" | "SKIPPED") => Promise<unknown>;
  send: (input: SendEmailInput) => Promise<SendEmailResult>;
};

const defaultDependencies: NotificationDependencies = {
  createRecord: (draft) => db.notification.create({ data: { ...draft, tenantId: draft.tenantId ?? null, relatedEntityType: draft.relatedEntityType ?? null, relatedEntityId: draft.relatedEntityId ?? null }, select: { id: true } }),
  recipientEmail: async (recipientId) => {
    const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { email: true, isActive: true } });
    return recipient?.isActive ? recipient.email : null;
  },
  updateEmailStatus: (id, emailStatus) => db.notification.update({ where: { id }, data: { emailStatus } }),
  send: sendEmail,
};

export async function createNotification(draft: NotificationDraft, dependencies: NotificationDependencies = defaultDependencies) {
  const notification = await dependencies.createRecord(draft);
  let status: "SENT" | "FAILED" | "SKIPPED" = "FAILED";
  try {
    const email = await dependencies.recipientEmail(draft.recipientId);
    status = email ? (await dependencies.send({ to: email, subject: draft.title, body: draft.body, linkPath: draft.linkPath })).status : "SKIPPED";
  } catch (error) {
    console.error(`Notification ${notification.id} email delivery failed.`, error);
  }
  try { await dependencies.updateEmailStatus(notification.id, status); }
  catch (error) { console.error(`Notification ${notification.id} email status could not be recorded.`, error); }
  return { id: notification.id, emailStatus: status };
}

export async function createNotifications(drafts: NotificationDraft[], dependencies: NotificationDependencies = defaultDependencies) {
  const results = await Promise.allSettled(drafts.map((draft) => createNotification(draft, dependencies)));
  results.forEach((result) => { if (result.status === "rejected") console.error("In-app notification creation failed.", result.reason); });
  return results;
}

export async function staffNotificationRecipientIds(firmId: string, tenantId: string) {
  const users = await db.user.findMany({
    where: { firmId, kind: "STAFF", isActive: true, OR: [{ staffRole: "SYSTEM_ADMIN" }, { assignments: { some: { tenantId } } }] },
    select: { id: true },
  });
  return [...new Set(users.map((user) => user.id))];
}

export async function clientNotificationRecipientIds(firmId: string, tenantId: string) {
  const users = await db.user.findMany({ where: { firmId, tenantId, kind: "CLIENT", isActive: true }, select: { id: true } });
  return users.map((user) => user.id);
}

export async function notificationsForUser(recipientId: string) {
  const notificationStore = db.notification;
  if (!notificationStore) {
    console.warn("Notification store is unavailable. Restart the application after regenerating Prisma Client.");
    return [];
  }
  return notificationStore.findMany({
    where: { recipientId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, title: true, body: true, linkPath: true, isRead: true, createdAt: true },
  });
}

type MarkReadDependencies = { markOne: (recipientId: string, notificationId: string, readAt: Date) => Promise<{ count: number }>; markAll: (recipientId: string, readAt: Date) => Promise<{ count: number }> };
const markReadDependencies: MarkReadDependencies = {
  markOne: (recipientId, notificationId, readAt) => db.notification?.updateMany({ where: { id: notificationId, recipientId, isRead: false }, data: { isRead: true, readAt } }) ?? Promise.resolve({ count: 0 }),
  markAll: (recipientId, readAt) => db.notification?.updateMany({ where: { recipientId, isRead: false }, data: { isRead: true, readAt } }) ?? Promise.resolve({ count: 0 }),
};

export function markNotificationReadForUser(recipientId: string, notificationId: string, dependencies: MarkReadDependencies = markReadDependencies) {
  return dependencies.markOne(recipientId, notificationId, new Date());
}

export function markAllNotificationsReadForUser(recipientId: string, dependencies: MarkReadDependencies = markReadDependencies) {
  return dependencies.markAll(recipientId, new Date());
}
