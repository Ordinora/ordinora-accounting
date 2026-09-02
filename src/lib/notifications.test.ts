import { describe, expect, it, vi } from "vitest";
import { createNotification, createNotifications, markAllNotificationsReadForUser, markNotificationReadForUser, type NotificationDraft } from "./notifications";

const draft: NotificationDraft = { firmId: "firm-1", tenantId: "tenant-1", recipientId: "user-1", type: "DOCUMENT_UPLOADED", title: "Document uploaded", body: "A client uploaded a document.", linkPath: "/settings/portal/documents", relatedEntityType: "Document", relatedEntityId: "document-1" };

describe("notification persistence and delivery", () => {
  it("creates the in-app notification before attempting email and records failure without rejecting", async () => {
    const events: string[] = [];
    const result = await createNotification(draft, {
      createRecord: async () => { events.push("created"); return { id: "notification-1" }; },
      recipientEmail: async () => "staff@example.com",
      send: async () => { events.push("email"); return { status: "FAILED" }; },
      updateEmailStatus: async (_id, status) => { events.push(`status:${status}`); },
    });
    expect(events).toEqual(["created", "email", "status:FAILED"]);
    expect(result).toEqual({ id: "notification-1", emailStatus: "FAILED" });
  });

  it("scopes mark-one and mark-all operations to the requesting recipient", async () => {
    const markOne = vi.fn().mockResolvedValue({ count: 1 });
    const markAll = vi.fn().mockResolvedValue({ count: 2 });
    const dependencies = { markOne, markAll };
    await markNotificationReadForUser("user-1", "notification-1", dependencies);
    await markAllNotificationsReadForUser("user-1", dependencies);
    expect(markOne).toHaveBeenCalledWith("user-1", "notification-1", expect.any(Date));
    expect(markAll).toHaveBeenCalledWith("user-1", expect.any(Date));
  });

  it("contains notification persistence failure instead of rejecting the triggering workflow", async () => {
    const results = await createNotifications([draft], {
      createRecord: async () => { throw new Error("notification table unavailable"); },
      recipientEmail: async () => "staff@example.com",
      send: async () => ({ status: "SENT" }),
      updateEmailStatus: async () => undefined,
    });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("rejected");
  });
});
