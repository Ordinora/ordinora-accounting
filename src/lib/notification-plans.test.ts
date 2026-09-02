import { describe, expect, it } from "vitest";
import { clientAssignmentNotificationDrafts, clientQuestionNotificationDrafts, documentNotificationDrafts, staffQuestionNotificationDrafts } from "./notification-plans";

describe("notification trigger plans", () => {
  it("creates released and quarantined document notifications for each unique staff recipient", () => {
    const common = { firmId: "firm", tenantId: "tenant", recipientIds: ["staff", "admin", "admin"], tenantName: "Client Co", actorName: "Client User", documentId: "doc", filename: "invoice.pdf" };
    expect(documentNotificationDrafts({ ...common, released: true })).toHaveLength(2);
    expect(documentNotificationDrafts({ ...common, released: true })[0].type).toBe("DOCUMENT_UPLOADED");
    expect(documentNotificationDrafts({ ...common, released: false })[0]).toMatchObject({ type: "DOCUMENT_QUARANTINED", relatedEntityId: "doc" });
  });

  it("creates exactly one notification for the newly-added tenant, not the whole assignment list", () => {
    const drafts = clientAssignmentNotificationDrafts({ firmId: "firm", recipientId: "staff", previousTenantIds: ["a"], tenants: [{ id: "a", legalName: "Existing" }, { id: "b", legalName: "New Client" }] });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ tenantId: "b", recipientId: "staff", type: "CLIENT_ASSIGNED" });
  });

  it("creates question notifications for assigned staff and administrators", () => {
    const drafts = staffQuestionNotificationDrafts({ firmId: "firm", tenantId: "tenant", recipientIds: ["staff", "admin"], tenantName: "Client Co", questionId: "question", subject: "Tax", actorName: "Client User", reply: false });
    expect(drafts).toHaveLength(2);
    expect(drafts.every((draft) => draft.type === "QUESTION_RAISED")).toBe(true);
  });

  it.each([
    { clientVisible: true, internalOnly: false, count: 2 },
    { clientVisible: true, internalOnly: true, count: 0 },
    { clientVisible: false, internalOnly: false, count: 0 },
    { clientVisible: false, internalOnly: true, count: 0 },
  ])("never creates client notifications outside both visibility gates", ({ count, ...visibility }) => {
    const drafts = clientQuestionNotificationDrafts({ firmId: "firm", tenantId: "tenant", recipientIds: ["client-1", "client-2"], questionId: "question", subject: "Tax", actorName: "Accountant", ...visibility });
    expect(drafts).toHaveLength(count);
  });
});
