import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CashSalesForm, DailySaleFormInitial } from "@/components/cash-sales-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { updateCashSales } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const [register, revenueAccounts, cashAccounts, items, locations, priorRegisters] = await Promise.all([
    db.dailyCashRegister.findFirst({ where: { id, tenantId: active.id }, include: { lines: true, tenders: true } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "REVENUE" }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" }, orderBy: { code: "asc" } }),
    db.inventoryItem.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { sku: "asc" } }),
    db.inventoryLocation.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
    db.dailyCashRegister.findMany({ where: { tenantId: active.id, branchLabel: { not: null } }, select: { branchLabel: true } }),
  ]);
  if (!register) notFound();
  const branches = [...new Set(["Main branch", ...locations.map((location) => location.branchLabel).filter((label): label is string => Boolean(label)), ...priorRegisters.map((entry) => entry.branchLabel).filter((label): label is string => Boolean(label))])].sort();
  const initial: DailySaleFormInitial = {
    id: register.id,
    reference: register.reference,
    registerDate: register.registerDate.toISOString().slice(0, 10),
    branchLabel: register.branchLabel ?? "",
    registerLabel: register.registerLabel ?? "",
    lines: register.lines.map((line) => ({ description: line.description, accountId: line.revenueAccountId, itemId: line.inventoryItemId ?? "", locationId: line.inventoryLocationId ?? "", quantity: line.quantity.toString(), price: line.unitPrice.toString(), discountType: line.discountPercent.gt(0) ? "PERCENT" : line.discountAmount.gt(0) ? "AMOUNT" : "NONE", discount: line.discountPercent.gt(0) ? line.discountPercent.toString() : line.discountAmount.toString() })),
    tenders: register.tenders.map((tender) => ({ type: tender.type, accountId: tender.accountId, amount: tender.amount.toString(), reference: tender.reference ?? "" })),
  };
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={`Edit daily sale ${register.reference}`} pageDescription="Update posted values and all connected accounting records">
    <main className="module-page form-page">
      <div className="form-notice"><strong>Connected update</strong><span>Saving replaces the posted sales lines, tenders, journal, and inventory movements in one transaction.</span></div>
      <CashSalesForm action={updateCashSales} initial={initial} submitLabel="Save posted values" revenueAccounts={revenueAccounts} cashAccounts={cashAccounts} inventoryItems={items.map((item) => ({ id: item.id, code: item.sku, name: item.name, revenueAccountId: item.revenueAccountId }))} inventoryLocations={locations} branches={branches} currency={register.currency} />
      {register.journalId && <div className="form-actions"><Link href={`/journals/${register.journalId}#delete-transaction`} className="button-danger"><Trash2 size={15} />Delete transaction</Link></div>}
    </main>
  </AppShell>;
}
