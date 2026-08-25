import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const databaseUrl = process.env.DATABASE_URL ?? "";
const confirmation = process.env.PERFORMANCE_FIXTURE_CONFIRM;

function count(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  return value;
}

function assertDisposableDatabase() {
  let databaseName = "";
  try { databaseName = new URL(databaseUrl).pathname.replace(/^\//, ""); } catch { /* handled below */ }
  if (!databaseName.endsWith("_e2e")) throw new Error("Performance fixtures may only be generated in a database ending in _e2e.");
  if (confirmation !== "GENERATE_DISPOSABLE_DATA") throw new Error("Set PERFORMANCE_FIXTURE_CONFIRM=GENERATE_DISPOSABLE_DATA to confirm the disposable load test.");
}

async function batches<T>(rows: T[], write: (batch: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += 1_000) await write(rows.slice(offset, offset + 1_000));
}

async function main() {
  assertDisposableDatabase();
  const journalCount = count("PERFORMANCE_JOURNALS", 25_000, 500_000);
  const invoiceCount = count("PERFORMANCE_INVOICES", 10_000, 250_000);
  const billCount = count("PERFORMANCE_BILLS", 10_000, 250_000);
  const movementCount = count("PERFORMANCE_MOVEMENTS", 50_000, 1_000_000);

  const tenant = await db.tenant.findFirst({
    where: { status: "ACTIVE", periods: { some: {} }, accounts: { some: {} } },
    include: {
      periods: { orderBy: { startsOn: "asc" }, take: 1 }, accounts: { where: { isActive: true }, orderBy: { code: "asc" } },
    },
  });
  if (!tenant || tenant.periods.length === 0 || tenant.accounts.length < 2) throw new Error("The disposable seed needs a tenant with a period and accounts.");
  const actor = await db.user.findFirstOrThrow({ where: { firmId: tenant.firmId, kind: "STAFF", isActive: true } });
  const assetAccount = tenant.accounts.find((account) => account.type === "ASSET") ?? tenant.accounts[0];
  const revenueAccount = tenant.accounts.find((account) => account.type === "REVENUE") ?? tenant.accounts[1];
  const expenseAccount = tenant.accounts.find((account) => account.type === "EXPENSE") ?? tenant.accounts[1];
  const customer = await db.customer.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PERF-CUSTOMER" } }, update: {},
    create: { tenantId: tenant.id, code: "PERF-CUSTOMER", name: "Disposable Performance Customer" },
  });
  const supplier = await db.supplier.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PERF-SUPPLIER" } }, update: {},
    create: { tenantId: tenant.id, code: "PERF-SUPPLIER", name: "Disposable Performance Supplier" },
  });
  const location = await db.inventoryLocation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PERF-LOCATION" } }, update: {},
    create: { tenantId: tenant.id, code: "PERF-LOCATION", name: "Disposable Performance Location" },
  });
  const item = await db.inventoryItem.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "PERF-ITEM" } }, update: {},
    create: { tenantId: tenant.id, sku: "PERF-ITEM", name: "Disposable Performance Item", inventoryAccountId: assetAccount.id, revenueAccountId: revenueAccount.id, cogsAccountId: expenseAccount.id },
  });
  const period = tenant.periods[0];
  const start = period.startsOn.getTime();
  const days = Math.max(1, Math.floor((period.endsOn.getTime() - start) / 86_400_000) + 1);
  const dateAt = (index: number) => new Date(start + (index % days) * 86_400_000);
  const prefix = `PERF-${Date.now()}`;
  const existing = await db.journal.count({ where: { tenantId: tenant.id, reference: { startsWith: "PERF-" } } });
  if (existing) throw new Error("Performance fixture data already exists. Reset the disposable database before generating another fixture.");

  const journals = Array.from({ length: journalCount }, (_, index) => ({
    id: `${prefix}-J-${index}`, tenantId: tenant.id, periodId: period.id, reference: `${prefix}-J-${index}`,
    description: "Disposable performance journal", accountingDate: dateAt(index), status: "POSTED" as const,
    source: "MANUAL" as const, createdById: actor.id, postedById: actor.id, postedAt: dateAt(index),
  }));
  await batches(journals, (data) => db.journal.createMany({ data }));
  const lines = journals.flatMap((journal, index) => {
    const amount = ((index % 9_900) + 100) / 100;
    return [
      { id: `${journal.id}-D`, journalId: journal.id, accountId: tenant.accounts[0].id, description: "Performance debit", debit: amount, credit: 0 },
      { id: `${journal.id}-C`, journalId: journal.id, accountId: tenant.accounts[1].id, description: "Performance credit", debit: 0, credit: amount },
    ];
  });
  await batches(lines, (data) => db.journalLine.createMany({ data }));

  const invoices = Array.from({ length: invoiceCount }, (_, index) => ({
    id: `${prefix}-SI-${index}`, tenantId: tenant.id, customerId: customer.id, periodId: period.id,
    reference: `${prefix}-SI-${index}`, invoiceDate: dateAt(index), dueDate: dateAt(index + 30), description: "Disposable performance invoice",
    foreignTotal: 100 + index % 500, baseTotal: 100 + index % 500, status: "POSTED" as const, createdById: actor.id, postedAt: dateAt(index),
  }));
  await batches(invoices, (data) => db.salesInvoice.createMany({ data }));

  const bills = Array.from({ length: billCount }, (_, index) => ({
    id: `${prefix}-PI-${index}`, tenantId: tenant.id, supplierId: supplier.id, periodId: period.id,
    reference: `${prefix}-PI-${index}`, billDate: dateAt(index), dueDate: dateAt(index + 30), description: "Disposable performance bill",
    foreignTotal: 50 + index % 400, baseTotal: 50 + index % 400, status: "POSTED" as const, createdById: actor.id, postedAt: dateAt(index),
  }));
  await batches(bills, (data) => db.supplierBill.createMany({ data }));

  const movements = Array.from({ length: movementCount }, (_, index) => {
    const inbound = index % 2 === 0;
    const quantity = inbound ? 10 : -7;
    return {
      id: `${prefix}-IM-${index}`, tenantId: tenant.id, itemId: item.id, locationId: location.id,
      type: inbound ? "PURCHASE" as const : "SALE" as const, movementDate: dateAt(index), quantity, unitCost: 2.5,
      totalCost: quantity * 2.5, reference: `${prefix}-IM-${index}`, sourceType: "PERFORMANCE_FIXTURE", createdById: actor.id,
    };
  });
  await batches(movements, (data) => db.inventoryMovement.createMany({ data }));

  console.info(JSON.stringify({ company: tenant.legalName, journalCount, journalLineCount: lines.length, invoiceCount, billCount, movementCount }));
}

main().finally(() => db.$disconnect());
