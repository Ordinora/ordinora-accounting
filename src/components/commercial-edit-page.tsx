import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CommercialEditForm } from "@/components/commercial-edit-form";
import { updatePurchase, updateSale } from "@/app/commercial/actions";
import { db } from "@/lib/db";
import { isPermittedPurchaseAccount, purchaseAccountTypes } from "@/lib/purchase-account-policy";
import { requireActiveTenant } from "@/lib/session";

export async function CommercialEditPage({ kind, id }: { kind: "sale" | "purchase"; id: string }) {
  const { user, tenants, active } = await requireActiveTenant();
  const isSale = kind === "sale";
  const raw = isSale
    ? await db.salesInvoice.findFirst({ where: { id, tenantId: active.id }, include: { customer: true, lines: true, allocations: true, creditNotes: true } })
    : await db.supplierBill.findFirst({ where: { id, tenantId: active.id }, include: { supplier: true, lines: true, allocations: true, creditNotes: true } });
  if (!raw) notFound();

  const lineAccountIds = raw.lines.map((line) => "revenueAccountId" in line ? line.revenueAccountId : line.expenseAccountId);
  const lineItemIds = raw.lines.flatMap((line) => line.inventoryItemId ? [line.inventoryItemId] : []);
  const lineLocationIds = raw.lines.flatMap((line) => line.inventoryLocationId ? [line.inventoryLocationId] : []);
  const [candidateAccounts, items, locations, mappingAccounts] = await Promise.all([
    db.account.findMany({ where: { tenantId: active.id, type: isSale ? "REVENUE" : { in: purchaseAccountTypes }, OR: [{ isActive: true }, { id: { in: lineAccountIds } }] }, include: { _count: { select: { inventoryAssetItems: true } } }, orderBy: { code: "asc" } }),
    db.inventoryItem.findMany({ where: { tenantId: active.id, OR: [{ isActive: true }, { id: { in: lineItemIds } }] }, orderBy: { sku: "asc" } }),
    db.inventoryLocation.findMany({ where: { tenantId: active.id, OR: [{ isActive: true }, { id: { in: lineLocationIds } }] }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true, type: { in: ["ASSET", "REVENUE", "EXPENSE"] } }, orderBy: { code: "asc" } }),
  ]);
  const accounts = isSale ? candidateAccounts : candidateAccounts.filter(isPermittedPurchaseAccount);
  const party = "customer" in raw ? raw.customer : raw.supplier;
  const documentDate = "invoiceDate" in raw ? raw.invoiceDate : raw.billDate;
  const linked = raw.allocations.length + raw.creditNotes.length;
  const sourceLocked = "salesOrderId" in raw ? Boolean(raw.salesOrderId || raw.quotationId) : Boolean(raw.purchaseOrderId);

  return <AppShell
    user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }}
    tenants={tenants}
    activeTenant={active}
    pageTitle={`${isSale ? "Sales invoice" : "Supplier bill"} ${raw.reference}`}
    pageDescription="View and update the connected commercial transaction"
  ><main className="module-page form-page"><CommercialEditForm
      kind={kind}
      action={isSale ? updateSale : updatePurchase}
      document={{
        id: raw.id,
        partyLabel: `${party.code} — ${party.name}`,
        reference: raw.reference,
        documentDate: documentDate.toISOString().slice(0, 10),
        dueDate: raw.dueDate.toISOString().slice(0, 10),
        description: raw.description ?? `${isSale ? "Sales invoice" : "Supplier bill"} ${raw.reference}`,
        currency: raw.currency,
        discountType: raw.discountType as "NONE" | "PERCENT" | "AMOUNT",
        discountValue: raw.discountValue.toString(),
        lines: raw.lines.map((line) => ({
          description: line.description,
          accountId: "revenueAccountId" in line ? line.revenueAccountId : line.expenseAccountId,
          itemId: line.inventoryItemId ?? "",
          locationId: line.inventoryLocationId ?? "",
          quantity: line.quantity.toString(),
          unitPrice: line.unitPrice.toString(),
          discountPercent: line.discountPercent.toString(),
        })),
      }}
      accounts={accounts}
      items={items}
      locations={locations}
      mappingAccounts={mappingAccounts}
      linked={linked}
      sourceLocked={sourceLocked}
      deleteHref={raw.journalId ? `/journals/${raw.journalId}#delete-transaction` : undefined}
    /></main></AppShell>;
}
