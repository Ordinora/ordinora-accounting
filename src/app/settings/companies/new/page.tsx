import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CompanyForm } from "@/components/company-form";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireStaff();
  if (!["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole ?? "")) throw new Error("Your role cannot create companies.");
  const { tenants, active } = await getAuthorizedTenant(user);
  if (!active) return <main className="module-page form-page first-company-page"><header className="module-header"><div><p className="eyebrow">{user.firm.name.toUpperCase()}</p><h1>Create your first client company</h1><p>Your administrator account is ready. Create a company to prepare its chart of accounts and start accounting.</p></div></header><CompanyForm/></main>;
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Company" pageDescription="Prepare a separate accounting file for a client"><main className="module-page form-page"><Link href="/settings/companies" className="back-link"><ArrowLeft size={15}/>Back to companies</Link><CompanyForm/></main></AppShell>;
}
