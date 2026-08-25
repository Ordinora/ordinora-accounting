import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rateBands = [
  { name: "SPK up to BND 500", salaryFrom: "0", salaryTo: "500", employeeRatePercent: "8.5", employerFixedAmount: "57.50" },
  { name: "SPK BND 500.01 to 1,500", salaryFrom: "500.01", salaryTo: "1500", employeeRatePercent: "8.5", employerRatePercent: "10.5", minimumEmployerAmount: "57.50" },
  { name: "SPK BND 1,500.01 to 2,800", salaryFrom: "1500.01", salaryTo: "2800", employeeRatePercent: "8.5", employerRatePercent: "9.5" },
  { name: "SPK above BND 2,800", salaryFrom: "2800.01", salaryTo: null, employeeRatePercent: "8.5", employerRatePercent: "8.5" },
] as const;

async function main() {
  const tenants = await prisma.tenant.findMany({ orderBy: { legalName: "asc" } });
  for (const [index, tenant] of tenants.entries()) {
    for (const band of rateBands) {
      await prisma.spkRateBand.upsert({
        where: { tenantId_name_effectiveFrom: { tenantId: tenant.id, name: band.name, effectiveFrom: new Date("2026-01-01") } },
        update: {},
        create: { tenantId: tenant.id, effectiveFrom: new Date("2026-01-01"), ...band },
      });
    }

    await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber: "DEMO-EMP-001" } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeNumber: "DEMO-EMP-001",
        fullName: `Fictional Payroll Employee ${index + 1}`,
        citizenship: "Brunei citizen (demonstration)",
        identityCardCategory: "Yellow (demonstration)",
        schemeEligible: true,
        payFrequency: "MONTHLY",
        basicSalary: index === 0 ? "2000" : index === 1 ? "1200" : "3000",
        department: "Operations",
        employmentStart: new Date("2026-01-01"),
      },
    });
  }
}

main().finally(async () => prisma.$disconnect());
