import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CompanyEditForm } from "@/components/company-edit-form";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { db } from "@/lib/db";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  if (user.staffRole !== "SYSTEM_ADMIN") throw new Error("Only the System Administrator can update companies.");
  const { id } = await params;
  const [{ tenants, active }, company] = await Promise.all([
    getAuthorizedTenant(user),
    db.tenant.findFirst({ where: { id, firmId: user.firmId }, include: { _count: { select: { journals: true } } } }),
  ]);
  if (!company) notFound();
  const content = <main className="module-page form-page">
    <Link href="/settings/companies" className="back-link"><ArrowLeft size={15}/>Back to companies</Link>
    <header className="module-header"><div><p className="eyebrow">{user.firm.name.toUpperCase()}</p><h2>Edit company</h2><p>Maintain the legal, reporting, and operating details for {company.legalName}.</p></div></header>
    <CompanyEditForm company={{ ...company, journalCount: company._count.journals }}/>
  </main>;
  const shellUser = { displayName: user.displayName, email: user.email, role: user.staffRole.replaceAll("_", " "), firmName: user.firm.name };
  if (!active) return <FirmAdminShell user={shellUser} pageTitle="Edit company" pageDescription="Maintain a client accounting file">{content}</FirmAdminShell>;
  return <AppShell user={shellUser} tenants={tenants} activeTenant={active} pageTitle="Edit Company" pageDescription="Maintain company details and status">{content}</AppShell>;
}
