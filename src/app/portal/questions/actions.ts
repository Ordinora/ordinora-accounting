"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { staffQuestionNotificationDrafts } from "@/lib/notification-plans";
import { createNotifications, staffNotificationRecipientIds } from "@/lib/notifications";
import { requireClient } from "@/lib/session";

const createSchema = z.object({ subject: z.string().trim().min(3).max(160), body: z.string().trim().min(3).max(4000), documentId: z.string().optional() });

async function notifyStaff({ firmId, tenantId, tenantName, questionId, subject, actorName, reply }: { firmId: string; tenantId: string; tenantName: string; questionId: string; subject: string; actorName: string; reply: boolean }) {
  try {
    const recipientIds = await staffNotificationRecipientIds(firmId, tenantId);
    await createNotifications(staffQuestionNotificationDrafts({
      firmId,
      tenantId,
      recipientIds,
      tenantName,
      questionId,
      subject,
      actorName,
      reply,
    }));
  } catch (notificationError) {
    console.error("Client question notifications could not be created.", notificationError);
  }
}

export async function createClientQuestion(formData: FormData) {
  const user = await requireClient();
  const tenant = user.tenant!;
  const input = createSchema.parse(Object.fromEntries(formData));
  let documentId: string | null = null;
  if (input.documentId) {
    const document = await db.document.findFirst({ where: { id: input.documentId, tenantId: tenant.id, uploadedById: user.id } });
    if (!document) throw new Error("The selected document is not available.");
    documentId = document.id;
  }
  const question = await db.$transaction(async (tx) => {
    const record = await tx.question.create({ data: { tenantId: tenant.id, documentId, subject: input.subject, clientVisible: true } });
    await tx.questionMessage.create({ data: { questionId: record.id, authorId: user.id, body: input.body, internalOnly: false } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: tenant.id, actorId: user.id, actorKind: "CLIENT", action: "PORTAL_QUESTION_CREATED", entityType: "Question", entityId: record.id, newValues: { subject: record.subject, documentId } } });
    return record;
  });
  await notifyStaff({ firmId: user.firmId, tenantId: tenant.id, tenantName: tenant.legalName, questionId: question.id, subject: question.subject, actorName: user.displayName, reply: false });
  redirect(`/portal/questions/${question.id}`);
}

export async function replyToQuestion(questionId: string, formData: FormData) {
  const user = await requireClient();
  const tenant = user.tenant!;
  const body = z.string().trim().min(1).max(4000).parse(formData.get("body"));
  const question = await db.question.findFirst({ where: { id: questionId, tenantId: tenant.id, clientVisible: true } });
  if (!question) throw new Error("Question not found.");
  await db.$transaction([
    db.questionMessage.create({ data: { questionId: question.id, authorId: user.id, body, internalOnly: false } }),
    db.question.update({ where: { id: question.id }, data: { status: question.status === "RESOLVED" ? "REOPENED" : question.status, resolvedAt: null } }),
    db.auditEvent.create({ data: { firmId: user.firmId, tenantId: tenant.id, actorId: user.id, actorKind: "CLIENT", action: "PORTAL_QUESTION_REPLIED", entityType: "Question", entityId: question.id } }),
  ]);
  await notifyStaff({ firmId: user.firmId, tenantId: tenant.id, tenantName: tenant.legalName, questionId: question.id, subject: question.subject, actorName: user.displayName, reply: true });
  redirect(`/portal/questions/${question.id}`);
}
