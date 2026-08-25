import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "";
const safeDatabase = (() => {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_e2e");
  } catch {
    return false;
  }
})();

test.skip(
  process.env.E2E_ALLOW_ACCOUNTING_WRITES !== "true" || !safeDatabase,
  "Run only through scripts/run-e2e-cycle.ps1 with a disposable *_e2e database.",
);

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
test.afterAll(async () => prisma.$disconnect());

async function completeInvoice(page: Page, reference: string) {
  await page.goto("/sales/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Automatic reference").uncheck();
  await page.getByLabel("Reference", { exact: true }).fill(reference);
  await page.getByLabel("Document date").fill("2026-08-24");
  await page.getByLabel("Due date").fill("2026-08-31");
  await page.getByLabel("Description", { exact: true }).fill("Concurrent duplicate test");
  await page.locator('input[name="lineDescription"]').fill("Concurrent sale");
  await page.locator('select[name="lineAccountId"]').selectOption({ index: 1 });
  await page.locator('input[name="lineQuantity"]').fill("1");
  await page.locator('input[name="lineUnitPrice"]').fill("75");
}

async function completeReceipt(page: Page, reference: string) {
  await page.goto("/receipts/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Automatic reference").uncheck();
  await page.getByLabel("Reference", { exact: true }).fill(reference);
  await page.getByLabel("Receipt date").fill("2026-08-25");
  await page.getByLabel("Cash or bank account").selectOption({ index: 1 });
  await page.locator('input[name="allocationAmount"]').filter({ visible: true }).fill("75");
}

test("simultaneous submissions create one invoice and one settlement only", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);

  const duplicatePage = await context.newPage();
  await Promise.all([
    completeInvoice(page, "E2E-DUP-INV-001"),
    completeInvoice(duplicatePage, "E2E-DUP-INV-001"),
  ]);
  await Promise.allSettled([
    page.getByRole("button", { name: "Post invoice" }).click(),
    duplicatePage.getByRole("button", { name: "Post invoice" }).click(),
  ]);
  await page.waitForTimeout(1_500);

  const invoice = await prisma.salesInvoice.findFirstOrThrow({
    where: { reference: "E2E-DUP-INV-001" },
  });
  expect(await prisma.salesInvoice.count({ where: { tenantId: invoice.tenantId, reference: invoice.reference } })).toBe(1);
  expect(await prisma.journal.count({ where: { tenantId: invoice.tenantId, reference: invoice.reference } })).toBe(1);

  const receiptPage = await context.newPage();
  const competingReceiptPage = await context.newPage();
  await Promise.all([
    completeReceipt(receiptPage, "E2E-CONCURRENT-RC-A"),
    completeReceipt(competingReceiptPage, "E2E-CONCURRENT-RC-B"),
  ]);
  await Promise.allSettled([
    receiptPage.getByRole("button", { name: "Post receipt" }).click(),
    competingReceiptPage.getByRole("button", { name: "Post receipt" }).click(),
  ]);
  await receiptPage.waitForTimeout(1_500);

  expect(await prisma.salesInvoiceAllocation.count({ where: { invoiceId: invoice.id } })).toBe(1);
  expect(await prisma.customerReceipt.count({
    where: { tenantId: invoice.tenantId, reference: { in: ["E2E-CONCURRENT-RC-A", "E2E-CONCURRENT-RC-B"] } },
  })).toBe(1);
  const refreshed = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
  expect(refreshed.status).toBe("PAID");
});
