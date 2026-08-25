import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight, BarChart3, BookOpen, Landmark, Package, ReceiptText,
  Settings, ShoppingCart, Sparkles, Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { navigationModulesForRole } from "@/lib/navigation-modules";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

const icons = {
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
} as const;

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const selectedModule = navigationModulesForRole(user.staffRole).find(item => item.key === key);
  if (!selectedModule) notFound();
  const ModuleIcon = icons[key as keyof typeof icons] ?? BookOpen;

  return <AppShell
    user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }}
    tenants={tenants}
    activeTenant={active}
    pageTitle={selectedModule.label}
    pageDescription={selectedModule.description}
  >
    <main className="module-page module-centre-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">{active.legalName.toUpperCase()}</p>
          <h2>{selectedModule.label}</h2>
          <p>{selectedModule.description} Select a function to continue.</p>
        </div>
        <span className="module-centre-icon"><ModuleIcon size={25} /></span>
      </header>
      <section className="module-function-grid" aria-label={`${selectedModule.label} functions`}>
        {selectedModule.links.map(link => <Link href={link.href} className="surface-card module-function-card" key={link.href}>
          <span className="module-function-icon"><ModuleIcon size={20} /></span>
          <div><h3>{link.label}</h3><p>{link.description}</p></div>
          <ArrowRight className="module-function-arrow" size={18} />
        </Link>)}
      </section>
    </main>
  </AppShell>;
}
