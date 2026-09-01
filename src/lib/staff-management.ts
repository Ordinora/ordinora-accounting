export const editableStaffRoles = ["ACCOUNTANT", "PAYROLL_OFFICER", "REVIEWER", "READ_ONLY"] as const;

export function uniqueStaffTenantIds(values: readonly FormDataEntryValue[]) {
  return [...new Set(values.map(String).filter(Boolean))];
}

export function assertMayChangeStaffStatus(input: { actorId: string; targetId: string; nextActive: boolean }) {
  if (input.actorId === input.targetId && !input.nextActive) throw new Error("You cannot deactivate your own System Administrator account.");
}

export function assertMayChangeStaffRole(input: { currentRole: string | null; nextRole: string }) {
  if (input.currentRole === "SYSTEM_ADMIN" && input.nextRole !== "SYSTEM_ADMIN") throw new Error("The System Administrator role cannot be removed from this screen.");
  if (input.currentRole !== "SYSTEM_ADMIN" && input.nextRole === "SYSTEM_ADMIN") throw new Error("System Administrator access cannot be delegated from this screen.");
}
