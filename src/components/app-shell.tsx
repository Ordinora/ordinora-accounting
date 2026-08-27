"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, ChevronDown, Landmark, LayoutDashboard, LogOut, Menu,
  Package, ReceiptText, Search, Settings, ShoppingCart, Sparkles, Users, X,
} from "lucide-react";
import { logout, selectTenant } from "@/app/actions";
import { navigationModulesForRole, type NavigationModule } from "@/lib/navigation-modules";

type TenantOption = { id: string; legalName: string };
type ShellUser = { displayName: string; email: string; role: string; firmName: string };
/* Module functions are rendered as cards in /modules/[key]. */
const moduleIcons: Record<string, typeof ReceiptText> = {
  automation: Sparkles,
  sales: ReceiptText,
  purchases: ShoppingCart,
  banking: Landmark,
  accounting: BookOpen,
  inventory: Package,
  "fixed-assets": Landmark,
  reports: BarChart3,
  payroll: Users,
  tax: ReceiptText,
  administration: Settings,
};

function moduleForPath(pathname: string, modules: NavigationModule[]) {
  const moduleCentre = modules.find((module) => pathname === `/modules/${module.key}`);
  if (moduleCentre) return moduleCentre.key;
  return modules.find((module) =>
    module.links.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`)),
  )?.key;
}

export function AppShell({
  user, tenants, activeTenant, pageTitle, pageDescription, children,
}: {
  user: ShellUser;
  tenants: TenantOption[];
  activeTenant: TenantOption;
  pageTitle: string;
  pageDescription: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const allowedModules = navigationModulesForRole(user.role);
  const currentModule = moduleForPath(pathname, allowedModules);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signoutOpen, setSignoutOpen] = useState(false);
  const initials = user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="omps-shell">
      {drawerOpen && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}
      <aside className={`omps-sidebar ${drawerOpen ? "drawer-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="logo-circle">O</span>
          <div><strong>Ordinora</strong><small>ACCOUNTING</small></div>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <p className="practice-name">{user.firmName}</p>

        <nav className="sidebar-nav" aria-label="Accounting navigation">
          <Link href="/" className={`sidebar-link sidebar-dashboard-link ${pathname === "/" ? "active" : ""}`} onClick={() => setDrawerOpen(false)}>
            <LayoutDashboard size={18} /><span>Dashboard</span>
          </Link>
          <p className="sidebar-section-label">Business modules</p>

          {allowedModules.map((module) => {
            const Icon = moduleIcons[module.key] ?? ReceiptText;
            const active = currentModule === module.key;
            return (
              <div className={`sidebar-module ${active ? "active" : ""}`} key={module.key}>
                <Link
                  href={`/modules/${module.key}`}
                  className="sidebar-module-button"
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon size={18} /><span>{module.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="environment-label"><span className="environment-dot" />LOCAL DEVELOPMENT<small>Version 0.1.0</small></div>
      </aside>

      <section className="omps-workspace">
        <header className="omps-header">
          <div className="header-title">
            <button className="menu-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu /></button>
            <div><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
          </div>
          <div className="header-tools">
            <label className="page-search"><Search size={16} /><span className="sr-only">Search current page</span><input placeholder="Search current page" /></label>
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
                <span className="header-avatar">{initials}</span>
                <span className="profile-copy"><strong>{user.displayName}</strong><small>{user.role}</small></span>
                <ChevronDown size={15} />
              </button>
              {menuOpen && (
                <div className="profile-menu">
                  <div className="profile-summary"><strong>{user.displayName}</strong><span>{user.email}</span><small>{user.role}</small></div>
                  <Link href="/profile" onClick={() => setMenuOpen(false)}><Settings size={15} />Profile & settings</Link>
                  <button className="signout-menu" onClick={() => { setMenuOpen(false); setSignoutOpen(true); }}><LogOut size={15} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="tenant-strip">
          <form action={selectTenant}>
            <label htmlFor="tenantId">Current client</label>
            <select id="tenantId" name="tenantId" defaultValue={activeTenant.id}>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.legalName}</option>)}
            </select>
            <button>Switch</button>
          </form>
        </div>
        <div className="omps-content">{children}</div>
      </section>

      {signoutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSignoutOpen(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title">
            <span className="modal-icon"><LogOut size={21} /></span>
            <h2 id="signout-title">Sign out of Ordinora?</h2>
            <p>Your secure session will end. You will need to sign in again to access accounting records.</p>
            <div className="modal-actions">
              <button className="button-secondary" onClick={() => setSignoutOpen(false)}>Cancel</button>
              <form action={logout}><button className="button-danger">Sign out</button></form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
