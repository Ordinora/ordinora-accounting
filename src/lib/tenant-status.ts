export class DormantCompanyError extends Error {}

export function assertTenantAllowsMutation(tenant: { status: string }) {
  if (tenant.status === "DORMANT") {
    throw new DormantCompanyError("This company is dormant and read-only. Reactivate it under Administration → Companies before making changes or posting transactions.");
  }
}
