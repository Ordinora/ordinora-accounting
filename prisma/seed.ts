import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bruneiChart } from "./brunei-chart";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.dailyCashSaleLine.deleteMany();
  await prisma.dailyCashTender.deleteMany();
  await prisma.dailyCashRegister.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryOperation.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.inventoryLocation.deleteMany();
  await prisma.salesInvoiceAllocation.deleteMany();
  await prisma.supplierBillAllocation.deleteMany();
  await prisma.customerReceipt.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.salesCreditNoteLine.deleteMany();
  await prisma.supplierCreditNoteLine.deleteMany();
  await prisma.salesCreditNote.deleteMany();
  await prisma.supplierCreditNote.deleteMany();
  await prisma.salesInvoiceLine.deleteMany();
  await prisma.supplierBillLine.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.supplierBill.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.reportVersion.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journal.deleteMany();
  await prisma.account.deleteMany();
  await prisma.accountingPeriod.deleteMany();
  await prisma.staffTenantAssignment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.firm.deleteMany();

  const passwordHash = await bcrypt.hash("DemoOnly-ChangeMe!", 12);
  const firm = await prisma.firm.create({ data: { name: "Meridian Advisory (Demo)" } });
  const accountant = await prisma.user.create({ data: { firmId: firm.id, kind: "STAFF", email: "accountant@demo.invalid", displayName: "Nur Aisyah", passwordHash, staffRole: "ACCOUNTANT" } });
  await prisma.user.create({ data: { firmId: firm.id, kind: "STAFF", email: "reviewer@demo.invalid", displayName: "Hafiz Rahman", passwordHash, staffRole: "REVIEWER" } });
  await prisma.user.create({ data: { firmId: firm.id, kind: "STAFF", email: "admin@demo.invalid", displayName: "Siti Mariam", passwordHash, staffRole: "FIRM_ADMIN" } });

  const clients = [
    { legalName: "Borneo Supply Co. (Demo)", entityType: "PRIVATE_LIMITED" as const, reportMode: "PUBLISHED_ONLY" as const, payrollVisibility: false, cards: ["cash", "revenue", "receivables", "payables"] },
    { legalName: "Temburong Craft Studio (Demo)", entityType: "SOLE_PROPRIETORSHIP" as const, reportMode: "LIVE_POSTED_AND_PUBLISHED" as const, payrollVisibility: true, cards: ["cash", "profit", "documents"] },
    { legalName: "Seri Partners (Demo)", entityType: "PARTNERSHIP" as const, reportMode: "PUBLISHED_ONLY" as const, payrollVisibility: false, cards: ["cash", "revenue", "compliance"] },
  ];

  for (let i = 0; i < clients.length; i++) {
    const item = clients[i];
    const tenant = await prisma.tenant.create({ data: { firmId: firm.id, legalName: item.legalName, registrationNumber: `DEMO-${1001 + i}`, entityType: item.entityType, financialYearEndMonth: 12, financialYearEndDay: 31, portalEnabled: true, reportMode: item.reportMode, payrollVisibility: item.payrollVisibility, documentUploadEnabled: true, enabledDashboardCards: item.cards } });
    await prisma.staffTenantAssignment.create({ data: { userId: accountant.id, tenantId: tenant.id } });
    await prisma.user.createMany({ data: [
      { firmId: firm.id, tenantId: tenant.id, kind: "CLIENT", email: `finance${i + 1}@demo.invalid`, displayName: `Demo Finance Viewer ${i + 1}`, passwordHash, clientRole: "CLIENT_FINANCE_VIEWER" },
      { firmId: firm.id, tenantId: tenant.id, kind: "CLIENT", email: `documents${i + 1}@demo.invalid`, displayName: `Demo Document User ${i + 1}`, passwordHash, clientRole: "CLIENT_DOCUMENT_CONTRIBUTOR" },
    ] });
    await prisma.customer.create({ data: { tenantId: tenant.id, code: `CUS-${i + 1}01`, name: `Fictional Customer ${i + 1}`, email: `customer${i + 1}@demo.invalid`, paymentTermsDays: 30 } });
    await prisma.supplier.create({ data: { tenantId: tenant.id, code: `SUP-${i + 1}01`, name: `Fictional Supplier ${i + 1}`, email: `supplier${i + 1}@demo.invalid`, paymentTermsDays: 30 } });
    const openPeriod = await prisma.accountingPeriod.create({ data: { tenantId: tenant.id, name: "August 2026", startsOn: new Date("2026-08-01"), endsOn: new Date("2026-08-31"), status: "OPEN" } });
    await prisma.accountingPeriod.create({ data: { tenantId: tenant.id, name: "July 2026", startsOn: new Date("2026-07-01"), endsOn: new Date("2026-07-31"), status: i === 0 ? "LOCKED" : "CLOSED", lockedAt: i === 0 ? new Date("2026-08-10") : null } });
    const accounts = await Promise.all(bruneiChart.map(([code, name, type, classification, isControlAccount]) => prisma.account.create({ data: { tenantId: tenant.id, code, name, type, reportingClassification: classification, isControlAccount: Boolean(isControlAccount) } })));
    const receivables = accounts.find((account) => account.code === "1200")!;
    const salesRevenue = accounts.find((account) => account.code === "4000")!;
    const journal = await prisma.journal.create({ data: { tenantId: tenant.id, periodId: openPeriod.id, reference: `SI-2026-${String(i + 1).padStart(4, "0")}`, description: "Fictional demonstration invoice", accountingDate: new Date("2026-08-05"), status: "POSTED", source: "SALES_INVOICE", createdById: accountant.id, approvedById: accountant.id, postedById: accountant.id, postedAt: new Date("2026-08-05T04:00:00Z"), lines: { create: [ { accountId: receivables.id, debit: "1250.00", credit: "0" }, { accountId: salesRevenue.id, debit: "0", credit: "1250.00" } ] } } });
    await prisma.reportVersion.create({ data: { tenantId: tenant.id, periodId: openPeriod.id, reportType: "MANAGEMENT_ACCOUNTS", state: "PUBLISHED", version: 1, payload: { currency: "BND", revenue: "1250.00", demonstration: true }, disclaimer: "Fictional demonstration figures for product testing only.", latestPostingAt: journal.postedAt, publishedAt: new Date("2026-08-12"), publishedById: accountant.id } });
  }
  await prisma.auditEvent.create({ data: { firmId: firm.id, actorId: accountant.id, actorKind: "STAFF", action: "DEMO_DATA_SEEDED", entityType: "Firm", entityId: firm.id, newValues: { fictional: true } } });
}

main().finally(async () => prisma.$disconnect());
