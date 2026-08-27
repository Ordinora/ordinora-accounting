import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { balanceSheetPdfSections } from "../src/lib/balance-sheet-report";
import { calculateBalanceSheet } from "../src/lib/financial-statements";
import { generateReportPdf } from "../src/lib/report-pdf";
import { formatCurrencyAmount } from "../src/lib/currency";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({
    where: { legalName: { equals: "Raghu Store Sdn Bhd", mode: "insensitive" } },
    select: { id: true, legalName: true, defaultCurrency: true },
  });
  const asOf = new Date("2026-08-26T23:59:59.999Z");
  const accounts = await db.account.findMany({
    where: { tenantId: tenant.id },
    orderBy: { code: "asc" },
    include: {
      lines: {
        where: {
          journal: {
            tenantId: tenant.id,
            status: { in: ["POSTED", "REVERSED"] },
            accountingDate: { lte: asOf },
          },
        },
        select: { debit: true, credit: true },
      },
    },
  });
  const balances = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    classification: account.reportingClassification,
    debit: account.lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0)),
    credit: account.lines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0)),
    balance: account.lines.reduce((sum, line) => sum.add(line.debit).sub(line.credit), new Prisma.Decimal(0)),
  })).filter((account) => !account.debit.eq(0) || !account.credit.eq(0));
  const statement = calculateBalanceSheet(balances);
  const amount = (value: Prisma.Decimal) => formatCurrencyAmount(tenant.defaultCurrency, value);
  const pdf = generateReportPdf({
    title: "Balance Sheet",
    company: tenant.legalName,
    subtitle: "As at 26/08/2026",
    sections: balanceSheetPdfSections(statement, amount),
  });
  const outputDirectory = path.resolve("output", "pdf");
  const outputPath = path.join(outputDirectory, "balance-sheet-raghu-store-2026-08-26.pdf");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, pdf);
  if (!statement.totalAssets.eq("166500") || !statement.totalLiabilitiesAndEquity.eq("166500") || !statement.difference.eq(0)) {
    throw new Error(`Unexpected Raghu Store balance sheet totals: assets ${statement.totalAssets.toFixed(2)}, liabilities and equity ${statement.totalLiabilitiesAndEquity.toFixed(2)}, difference ${statement.difference.toFixed(2)}.`);
  }
  console.log(JSON.stringify({
    company: tenant.legalName,
    totalAssets: statement.totalAssets.toFixed(2),
    totalLiabilitiesAndEquity: statement.totalLiabilitiesAndEquity.toFixed(2),
    difference: statement.difference.toFixed(2),
    outputPath,
  }, null, 2));
}

main().finally(() => db.$disconnect());
