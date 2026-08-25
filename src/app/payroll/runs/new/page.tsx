import { AppShell } from "@/components/app-shell";
import { PayrollRunForm } from "@/components/payroll-run-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const employees = await db.employee.findMany({ where: { tenantId: active.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } });
  return (
    <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Prepare payroll" pageDescription="Calculate employee pay and SPK in a controlled draft run">
      <main className="module-page">
        <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>New payroll run</h2><p>All active employees are included. Review the calculated totals before approval and posting.</p></div></header>
        <PayrollRunForm employees={employees.map((employee) => ({ id: employee.id, employeeNumber: employee.employeeNumber, fullName: employee.fullName, basicSalary: Number(employee.basicSalary).toFixed(2) }))} />
      </main>
    </AppShell>
  );
}
