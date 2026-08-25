export type StaffAccessRole =
  | "SYSTEM_ADMIN"
  | "FIRM_ADMIN"
  | "ACCOUNTANT"
  | "PAYROLL_OFFICER"
  | "REVIEWER"
  | "READ_ONLY";

const moduleAccess: Record<StaffAccessRole, readonly string[]> = {
  SYSTEM_ADMIN: ["automation", "sales", "purchases", "banking", "accounting", "inventory", "fixed-assets", "reports", "payroll", "tax", "administration"],
  FIRM_ADMIN: [],
  ACCOUNTANT: ["automation", "sales", "purchases", "banking", "accounting", "inventory", "fixed-assets", "reports", "payroll", "tax"],
  PAYROLL_OFFICER: ["reports", "payroll"],
  REVIEWER: ["automation", "accounting", "reports"],
  READ_ONLY: ["reports"],
};

export function normalizeStaffRole(role: string | null | undefined): StaffAccessRole | null {
  const normalized = role?.trim().toUpperCase().replaceAll(" ", "_");
  return normalized && normalized in moduleAccess ? normalized as StaffAccessRole : null;
}

export function canAccessModule(role: string | null | undefined, moduleKey: string) {
  const normalized = normalizeStaffRole(role);
  return normalized ? moduleAccess[normalized].includes(moduleKey) : false;
}

export function isSystemAdministrator(role: string | null | undefined) {
  return normalizeStaffRole(role) === "SYSTEM_ADMIN";
}
