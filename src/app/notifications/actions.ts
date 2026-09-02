"use server";

import { markAllNotificationsReadForUser, markNotificationReadForUser, notificationsForUser } from "@/lib/notifications";
import { requireClient, requireStaff } from "@/lib/session";

function safeNotifications(recipientId: string) {
  return notificationsForUser(recipientId).then((notifications) => notifications.map((notification) => ({ ...notification, createdAt: notification.createdAt.toISOString() })));
}

export async function loadStaffNotifications() {
  const user = await requireStaff();
  return safeNotifications(user.id);
}

export async function markStaffNotificationRead(notificationId: string) {
  const user = await requireStaff();
  await markNotificationReadForUser(user.id, notificationId);
  return { success: true };
}

export async function markAllStaffNotificationsRead() {
  const user = await requireStaff();
  await markAllNotificationsReadForUser(user.id);
  return { success: true };
}

export async function loadClientNotifications() {
  const user = await requireClient();
  return safeNotifications(user.id);
}

export async function markClientNotificationRead(notificationId: string) {
  const user = await requireClient();
  await markNotificationReadForUser(user.id, notificationId);
  return { success: true };
}

export async function markAllClientNotificationsRead() {
  const user = await requireClient();
  await markAllNotificationsReadForUser(user.id);
  return { success: true };
}
