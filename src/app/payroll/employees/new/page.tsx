import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireActiveTenant } from "@/lib/session";
import { createEmployee } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  return (
    <AppShell
      user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }}
      tenants={tenants}
      activeTenant={active}
      pageTitle="New employee"
      pageDescription="Create a tenant-isolated payroll employee record"
    >
      <main className="module-page form-page">
        <header className="module-header">
          <div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Employee details</h2><p>Payroll and SPK eligibility are kept separate from general client access.</p></div>
        </header>
        <form action={createEmployee} className="form-panel">
          <section className="form-section">
            <div className="section-heading"><h2>Employment information</h2><p>Enter the employee’s payroll classification and starting pay basis.</p></div>
            <div className="form-grid">
              <label>Employee number <em>*</em><input name="employeeNumber" required placeholder="EMP-001" /></label>
              <label>Full name <em>*</em><input name="fullName" required /></label>
              <label>Identity reference<input name="identityReference" autoComplete="off" /></label>
              <label>Citizenship / residency <em>*</em><select name="citizenship" required defaultValue=""><option value="" disabled>Select status</option><option value="Brunei citizen">Brunei citizen</option><option value="Permanent resident">Permanent resident</option><option value="Foreign national / temporary resident">Foreign national / temporary resident</option><option value="Other">Other</option></select></label>
              <label>Identity-card category <em>*</em><select name="identityCardCategory" required defaultValue=""><option value="" disabled>Select identity document</option><option value="Yellow identity card">Yellow — Brunei citizen</option><option value="Purple identity card">Purple — permanent resident</option><option value="Green identity card">Green — foreign/temporary resident</option><option value="Passport or other document">Passport or other document</option></select></label>
              <label>Department<input name="department" /></label>
              <label>Employment start <em>*</em><input name="employmentStart" type="date" required /></label>
              <label>Pay frequency <em>*</em><select name="payFrequency" defaultValue="MONTHLY"><option value="MONTHLY">Monthly</option><option value="HOURLY">Hourly</option></select></label>
              <label>Basic monthly salary ({active.defaultCurrency}) <em>*</em><input name="basicSalary" type="number" min="0" step="0.01" defaultValue="0.00" required /></label>
              <label>Hourly rate ({active.defaultCurrency})<input name="hourlyRate" type="number" min="0" step="0.01" /></label>
              <label>SPK eligible <em>*</em><select name="schemeEligible" defaultValue="yes"><option value="yes">Yes</option><option value="no">No</option></select></label>
            </div>
          </section>
          <div className="form-actions"><Link href="/payroll/employees" className="button-secondary">Cancel</Link><button className="button-primary">Create employee</button></div>
        </form>
      </main>
    </AppShell>
  );
}
