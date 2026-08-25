import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { CompanyForm } from "@/components/company-form";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireStaff();
  if (user.staffRole !== "SYSTEM_ADMIN") throw new Error("Only the System Administrator can create companies.");
  const { tenants, active } = await getAuthorizedTenant(user);
  if (!active) return <FirmAdminShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"ADMIN",firmName:user.firm.name}} pageTitle="New company" pageDescription="Create the first isolated client accounting file"><main className="module-page form-page first-company-page"><Link href="/settings/companies" className="back-link"><ArrowLeft size={15}/>Back to companies</Link><header className="module-header"><div><p className="eyebrow">{user.firm.name.toUpperCase()}</p><h2>Create your first client company</h2><p>The company will receive its own chart of accounts and accounting records.</p></div></header><CompanyForm/></main></FirmAdminShell>;
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Company" pageDescription="Prepare a separate accounting file for a client"><main className="module-page form-page"><Link href="/settings/companies" className="back-link"><ArrowLeft size={15}/>Back to companies</Link><CompanyForm/></main></AppShell>;
}
