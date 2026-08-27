import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { calculateProfitLoss } from "../src/lib/profit-loss";
import { profitLossPdfSections } from "../src/lib/profit-loss-report";
import { generateReportPdf } from "../src/lib/report-pdf";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({
    where: { legalName: { contains: "Seri Rasa", mode: "insensitive" } },
    select: { id: true, legalName: true, defaultCurrency: true },
  });
  const from = new Date("2026-01-01T00:00:00.000Z");
  const to = new Date("2026-08-26T23:59:59.999Z");
  const accounts = await db.account.findMany({
    where: { tenantId: tenant.id },
    orderBy: { code: "asc" },
    include: {
      lines: {
        where: {
          journal: {
            tenantId: tenant.id,
            status: { in: ["POSTED", "REVERSED"] },
            accountingDate: { gte: from, lte: to },
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
  const statement = calculateProfitLoss(balances);
  const amount = (value: Prisma.Decimal) => new Intl.NumberFormat("en-BN", {
    style: "currency",
    currency: tenant.defaultCurrency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(value.toNumber());
  const sections = profitLossPdfSections(statement, amount);
  const pdf = generateReportPdf({
    title: "Income Statement",
    company: tenant.legalName,
    subtitle: "For the period 01/01/2026 to 26/08/2026",
    sections,
  });
  const outputDirectory = path.resolve("output", "pdf");
  const outputPath = path.join(outputDirectory, "income-statement-seri-rasa-2026-08-26.pdf");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, pdf);
  console.log(JSON.stringify({
    company: tenant.legalName,
    sectionTitles: sections.map((section) => section.title).filter(Boolean),
    netIncome: statement.netIncome.toFixed(2),
    outputPath,
  }, null, 2));
}

main().finally(() => db.$disconnect());
