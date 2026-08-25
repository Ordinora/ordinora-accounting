import { describe, expect, it } from "vitest";
import { assertPayrollAccess, assertTenantAccess, AuthorizationError } from "./authorization";

describe("tenant authorization", () => {
  it("rejects client tenant-id tampering", () => {
    expect(() => assertTenantAccess({ userId: "u1", firmId: "f1", kind: "CLIENT", tenantId: "tenant-a" }, "tenant-b")).toThrow(AuthorizationError);
  });
  it("limits ordinary staff to assignments", () => {
    const actor = { userId: "u2", firmId: "f1", kind: "STAFF" as const, staffRole: "ACCOUNTANT" as const, assignedTenantIds: ["tenant-a"] };
    expect(() => assertTenantAccess(actor, "tenant-b")).toThrow(AuthorizationError);
    expect(() => assertTenantAccess(actor, "tenant-a")).not.toThrow();
  });
  it("keeps payroll separate from general finance", () => {
    const viewer = { userId: "u3", firmId: "f1", kind: "CLIENT" as const, tenantId: "tenant-a", clientPermissions: ["reports:view"] };
    expect(() => assertPayrollAccess(viewer, "aggregate")).toThrow(AuthorizationError);
  });
});
