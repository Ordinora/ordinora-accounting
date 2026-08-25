import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const limit = Number(process.env.ACCOUNTING_QUERY_LIMIT_MS || 2_000);

async function measured<T>(name: string, query: () => Promise<T>) {
  const started = performance.now();
  const value = await query();
  const milliseconds = Math.round((performance.now() - started) * 10) / 10;
  return { name, milliseconds, resultRows: Array.isArray(value) ? value.length : undefined, passed: milliseconds <= limit };
}

const querySuite = (tenantId: string, asOf: Date) => Promise.all([
  measured("posted-ledger-aggregation", () => db.journalLine.groupBy({ by: ["accountId"], where: { journal: { tenantId, accountingDate: { lte: asOf }, status: { in: ["POSTED", "REVERSED"] } } }, _sum: { debit: true, credit: true } })),
  measured("receivables-date-scan", () => db.salesInvoice.findMany({ where: { tenantId, invoiceDate: { lte: asOf }, status: { not: "VOIDED" } }, select: { id: true, baseTotal: true }, take: 10_000 })),
  measured("payables-date-scan", () => db.supplierBill.findMany({ where: { tenantId, billDate: { lte: asOf }, status: { not: "VOIDED" } }, select: { id: true, baseTotal: true }, take: 10_000 })),
  measured("inventory-movement-aggregation", () => db.inventoryMovement.groupBy({ by: ["itemId", "locationId"], where: { tenantId, movementDate: { lte: asOf } }, _sum: { quantity: true, totalCost: true } })),
]);

async function main() {
  if (!Number.isFinite(limit) || limit < 1) throw new Error("ACCOUNTING_QUERY_LIMIT_MS must be a positive number.");
  const tenant = await db.tenant.findFirst({ where: { status: "ACTIVE" }, orderBy: { journals: { _count: "desc" } }, select: { id: true, legalName: true } });
  if (!tenant) throw new Error("No active company is available for the performance check.");
  const asOf = new Date();
  const dataset = await Promise.all([
    db.journal.count({ where: { tenantId: tenant.id } }), db.journalLine.count({ where: { journal: { tenantId: tenant.id } } }),
    db.salesInvoice.count({ where: { tenantId: tenant.id } }), db.supplierBill.count({ where: { tenantId: tenant.id } }),
    db.inventoryMovement.count({ where: { tenantId: tenant.id } }),
  ]);
  const cold = await querySuite(tenant.id, asOf);
  const warm = await querySuite(tenant.id, asOf);
  const [journals, journalLines, salesInvoices, supplierBills, inventoryMovements] = dataset;
  console.info(JSON.stringify({ checkedAt: new Date().toISOString(), company: tenant.legalName, thresholdMilliseconds: limit, dataset: { journals, journalLines, salesInvoices, supplierBills, inventoryMovements }, cold, warm }));
  if ([...cold, ...warm].some((result) => !result.passed)) throw new Error("One or more accounting queries exceeded the acceptance threshold.");
}

main().finally(() => db.$disconnect());
