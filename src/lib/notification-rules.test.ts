import { describe, expect, it } from "vitest";
import { clientMayReceiveQuestionNotification, documentNotificationType, newlyAssignedTenantIds } from "./notification-rules";

describe("notification trigger rules", () => {
  it("notifies only for newly-added client assignments", () => {
    expect(newlyAssignedTenantIds(["tenant-a", "tenant-b"], ["tenant-b", "tenant-c", "tenant-c"])).toEqual(["tenant-c"]);
  });

  it("distinguishes released and quarantined documents", () => {
    expect(documentNotificationType(true)).toBe("DOCUMENT_UPLOADED");
    expect(documentNotificationType(false)).toBe("DOCUMENT_QUARANTINED");
  });

  it.each([
    { clientVisible: true, internalOnly: false, expected: true },
    { clientVisible: true, internalOnly: true, expected: false },
    { clientVisible: false, internalOnly: false, expected: false },
    { clientVisible: false, internalOnly: true, expected: false },
  ])("enforces both client visibility controls: $clientVisible / $internalOnly", ({ expected, ...input }) => {
    expect(clientMayReceiveQuestionNotification(input)).toBe(expected);
  });
});
