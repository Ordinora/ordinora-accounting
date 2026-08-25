import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function positiveInteger(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  return value;
}

function percentile(values: number[], percentage: number) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * percentage) - 1)] ?? 0;
}

async function measured(name: string, query: () => Promise<unknown>) {
  const started = performance.now();
  await query();
  return { name, milliseconds: Math.round((performance.now() - started) * 10) / 10 };
}

async function main() {
  const users = positiveInteger("ACCOUNTING_CONCURRENT_USERS", 20, 200);
  const requestsPerUser = positiveInteger("ACCOUNTING_REQUESTS_PER_USER", 12, 500);
  const p95Limit = positiveInteger("ACCOUNTING_CONCURRENT_P95_MS", 1_500, 60_000);
  const tenant = await db.tenant.findFirst({
    where: { status: "ACTIVE" }, orderBy: { journals: { _count: "desc" } }, select: { id: true, legalName: true },
  });
  if (!tenant) throw new Error("No active company is available for concurrent acceptance.");
  const asOf = new Date();
  const workloads = [
    { name: "accountant-ledger", run: () => db.journalLine.groupBy({ by: ["accountId"], where: { journal: { tenantId: tenant.id, accountingDate: { lte: asOf }, status: { in: ["POSTED", "REVERSED"] } } }, _sum: { debit: true, credit: true } }) },
    { name: "accountant-recent-journals", run: () => db.journal.findMany({ where: { tenantId: tenant.id }, orderBy: [{ accountingDate: "desc" }, { createdAt: "desc" }], select: { id: true, reference: true, accountingDate: true, status: true }, take: 50 }) },
    { name: "portal-receivables", run: () => db.salesInvoice.findMany({ where: { tenantId: tenant.id, invoiceDate: { lte: asOf }, status: { not: "VOIDED" } }, select: { id: true, baseTotal: true, dueDate: true }, take: 10_000 }) },
    { name: "portal-payables", run: () => db.supplierBill.findMany({ where: { tenantId: tenant.id, billDate: { lte: asOf }, status: { not: "VOIDED" } }, select: { id: true, baseTotal: true, dueDate: true }, take: 10_000 }) },
    { name: "portal-inventory", run: () => db.inventoryMovement.groupBy({ by: ["itemId", "locationId"], where: { tenantId: tenant.id, movementDate: { lte: asOf } }, _sum: { quantity: true, totalCost: true } }) },
  ];

  const started = performance.now();
  const settled = await Promise.allSettled(Array.from({ length: users }, async (_, userIndex) => {
    const results = [];
    for (let requestIndex = 0; requestIndex < requestsPerUser; requestIndex += 1) {
      const workload = workloads[(userIndex + requestIndex) % workloads.length];
      results.push(await measured(workload.name, workload.run));
    }
    return results;
  }));
  const failures = settled.filter((result) => result.status === "rejected");
  const results = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const durations = results.map((result) => result.milliseconds);
  const byWorkload = Object.fromEntries(workloads.map((workload) => {
    const values = results.filter((result) => result.name === workload.name).map((result) => result.milliseconds);
    return [workload.name, { requests: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95), p99: percentile(values, 0.99), maximum: Math.max(...values, 0) }];
  }));
  const elapsedSeconds = Math.round(((performance.now() - started) / 1000) * 100) / 100;
  const summary = {
    checkedAt: new Date().toISOString(), company: tenant.legalName, concurrentUsers: users, requestsPerUser,
    totalRequests: users * requestsPerUser, completedRequests: results.length, failures: failures.length,
    elapsedSeconds, requestsPerSecond: elapsedSeconds ? Math.round((results.length / elapsedSeconds) * 10) / 10 : results.length,
    thresholdP95Milliseconds: p95Limit,
    overall: { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), p99: percentile(durations, 0.99), maximum: Math.max(...durations, 0) },
    byWorkload,
  };
  console.info(JSON.stringify(summary));
  if (failures.length) throw new Error(`${failures.length} concurrent virtual users failed.`);
  if (summary.overall.p95 > p95Limit) throw new Error(`Concurrent accounting p95 ${summary.overall.p95} ms exceeded ${p95Limit} ms.`);
}

main().finally(() => db.$disconnect());
