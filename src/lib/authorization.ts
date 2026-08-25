export type AccessContext = Readonly<{
  userId: string;
  kind: "STAFF" | "CLIENT";
  firmId: string;
  tenantId?: string;
  staffRole?: "SYSTEM_ADMIN" | "FIRM_ADMIN" | "ACCOUNTANT" | "PAYROLL_OFFICER" | "REVIEWER" | "READ_ONLY";
  clientPermissions?: readonly string[];
  assignedTenantIds?: readonly string[];
}>;

export class AuthorizationError extends Error {}

export function assertTenantAccess(context: AccessContext, requestedTenantId: string) {
  if (context.kind === "CLIENT") {
    if (!context.tenantId || context.tenantId !== requestedTenantId) throw new AuthorizationError("Tenant access denied.");
    return;
  }
  if (context.staffRole === "SYSTEM_ADMIN" || context.staffRole === "FIRM_ADMIN") return;
  if (!context.assignedTenantIds?.includes(requestedTenantId)) throw new AuthorizationError("Tenant access denied.");
}

export function assertClientPermission(context: AccessContext, permission: string) {
  if (context.kind !== "CLIENT" || !context.clientPermissions?.includes(permission)) {
    throw new AuthorizationError("Permission denied.");
  }
}

export function assertPayrollAccess(context: AccessContext, level: string) {
  assertClientPermission(context, `payroll:${level}`);
}
