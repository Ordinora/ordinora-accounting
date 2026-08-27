import Link from "next/link";
import { Building2, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { db } from "@/lib/db";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireStaff();
  if (!["SYSTEM_ADMIN", "FIRM_ADMIN"].includes(user.staffRole ?? "")) {
    throw new Error("Your role cannot manage companies.");
  }

  const { tenants, active } = await getAuthorizedTenant(user);
  const companies = await db.tenant.findMany({
    where: { firmId: user.firmId },
    include: {
      _count: { select: { accounts: true, journals: true, periods: true } },
    },
    orderBy: { legalName: "asc" },
  });
  const canManageCompanies = user.staffRole === "SYSTEM_ADMIN";

  const content = (
    <main className="module-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">{user.firm.name.toUpperCase()}</p>
          <h2>Company register</h2>
          <p>Each client company has isolated accounts, users, transactions, and reports.</p>
        </div>
        {canManageCompanies && (
          <Link href="/settings/companies/new" className="button-primary">
            <Plus size={16} /> New company
          </Link>
        )}
      </header>

      <section className="surface-card table-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Entity</th>
                <th>Currency</th>
                <th>Periods</th>
                <th>Accounts</th>
                <th>Journals</th>
                <th>Status</th>
                {canManageCompanies && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <span className="record-link">
                      <Building2 size={15} />
                      <strong>{company.legalName}</strong>
                    </span>
                    {company.tradingName && <small>{company.tradingName}</small>}
                  </td>
                  <td>{company.entityType.replaceAll("_", " ")}</td>
                  <td>{company.defaultCurrency}</td>
                  <td>{company._count.periods}</td>
                  <td>{company._count.accounts}</td>
                  <td>{company._count.journals}</td>
                  <td>
                    <span className={`status-badge ${company.status === "ACTIVE" ? "active" : "inactive"}`}>
                      {company.status}
                    </span>
                  </td>
                  {canManageCompanies && (
                    <td>
                      <Link href={`/settings/companies/${company.id}/edit`} className="table-action">
                        <Pencil size={14} /> Edit
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
              {!companies.length && (
                <tr>
                  <td colSpan={canManageCompanies ? 8 : 7}>
                    <div className="table-empty">
                      No companies yet. Select New company to create the first client accounting file.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );

  if (!active) {
    return (
      <FirmAdminShell
        user={{
          displayName: user.displayName,
          email: user.email,
          role: user.staffRole?.replaceAll("_", " ") ?? "ADMIN",
          firmName: user.firm.name,
        }}
        pageTitle="Companies & clients"
        pageDescription="Create and manage client accounting files"
      >
        {content}
      </FirmAdminShell>
    );
  }

  return (
    <AppShell
      user={{
        displayName: user.displayName,
        email: user.email,
        role: user.staffRole?.replaceAll("_", " ") ?? "STAFF",
        firmName: user.firm.name,
      }}
      tenants={tenants}
      activeTenant={active}
      pageTitle="Companies"
      pageDescription="Client companies and isolated accounting records"
    >
      {content}
    </AppShell>
  );
}
