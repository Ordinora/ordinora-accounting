"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { logout } from "@/app/actions";

type FirmAdminUser = {
  displayName: string;
  email: string;
  role: string;
  firmName: string;
};

export function FirmAdminShell({
  user,
  pageTitle,
  pageDescription,
  children,
}: {
  user: FirmAdminUser;
  pageTitle: string;
  pageDescription: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const initials = user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <div className="firm-admin-shell">
    <aside className="firm-admin-sidebar">
      <div className="sidebar-brand"><span className="logo-circle">O</span><div><strong>Ordinora</strong><small>ACCOUNTING</small></div></div>
      <p className="practice-name">{user.firmName}</p>
      <nav aria-label="Firm administration">
        <Link href="/" className={pathname === "/" ? "active" : ""}><LayoutDashboard size={18}/>Administrator dashboard</Link>
        <p>Administration</p>
        <Link href="/settings/companies" className={pathname.startsWith("/settings/companies") ? "active" : ""}><Building2 size={18}/>Companies & clients</Link>
      </nav>
      <div className="firm-admin-identity"><ShieldCheck size={18}/><div><strong>{user.displayName}</strong><small>{user.role}</small></div></div>
      <form action={logout}><button><LogOut size={16}/>Sign out</button></form>
    </aside>
    <section className="firm-admin-workspace">
      <header><div><h1>{pageTitle}</h1><p>{pageDescription}</p></div><div className="firm-admin-profile"><span>{initials}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div></header>
      <div className="firm-admin-content">{children}</div>
    </section>
  </div>;
}
