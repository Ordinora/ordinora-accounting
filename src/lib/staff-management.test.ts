import { describe, expect, it } from "vitest";
import { assertMayChangeStaffRole, assertMayChangeStaffStatus, editableStaffRoles, uniqueStaffTenantIds } from "./staff-management";

describe("staff management safeguards", () => {
  it("blocks self-deactivation but permits other activation changes", () => {
    expect(() => assertMayChangeStaffStatus({ actorId: "admin", targetId: "admin", nextActive: false })).toThrow(/cannot deactivate your own/);
    expect(() => assertMayChangeStaffStatus({ actorId: "admin", targetId: "staff", nextActive: false })).not.toThrow();
    expect(() => assertMayChangeStaffStatus({ actorId: "admin", targetId: "admin", nextActive: true })).not.toThrow();
  });

  it("does not delegate or remove the System Administrator role", () => {
    expect(() => assertMayChangeStaffRole({ currentRole: "SYSTEM_ADMIN", nextRole: "ACCOUNTANT" })).toThrow(/cannot be removed/);
    expect(() => assertMayChangeStaffRole({ currentRole: "ACCOUNTANT", nextRole: "SYSTEM_ADMIN" })).toThrow(/cannot be delegated/);
    expect(() => assertMayChangeStaffRole({ currentRole: "ACCOUNTANT", nextRole: "REVIEWER" })).not.toThrow();
    expect(editableStaffRoles).not.toContain("FIRM_ADMIN");
  });

  it("deduplicates selected client assignments", () => {
    expect(uniqueStaffTenantIds(["tenant-1", "tenant-1", "tenant-2", ""])).toEqual(["tenant-1", "tenant-2"]);
  });
});
