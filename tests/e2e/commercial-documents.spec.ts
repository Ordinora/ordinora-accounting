import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const safeDatabase = (() => { try { return new URL(process.env.E2E_DATABASE_URL ?? "").pathname.replace(/^\//, "").endsWith("_e2e"); } catch { return false; } })();
test.skip(process.env.E2E_ALLOW_ACCOUNTING_WRITES !== "true" || !safeDatabase, "Run only through scripts/run-e2e-cycle.ps1 with a disposable *_e2e database.");

test("quotation and order chains remain non-ledger until invoice or bill conversion", async ({ page }) => {
  const db = new PrismaClient();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);
  const startingJournals = await db.journal.count();

  await page.goto("/sales/quotations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Quotation date").fill("2026-08-24");
  await page.getByLabel("Valid until").fill("2026-09-15");
  await page.getByLabel("Description", { exact: true }).fill("E2E quotation to order");
  await page.locator('input[name="lineDescription"]').fill("Professional service");
  await page.locator('select[name="lineAccountId"]').selectOption({ index: 1 });
  await page.locator('input[name="lineUnitPrice"]').fill("250");
  await page.getByRole("button", { name: "Save draft quotation" }).click();
  await expect(page).toHaveURL(/\/sales\/quotations\//);
  expect(await db.journal.count()).toBe(startingJournals);
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("button", { name: "Convert to sales order" }).click();
  await expect(page).toHaveURL(/\/sales\/orders\//);
  expect(await db.journal.count()).toBe(startingJournals);
  await page.getByRole("button", { name: "Confirm order" }).click();
  await page.getByRole("button", { name: "Mark ready to invoice" }).click();
  await page.getByRole("button", { name: "Convert to posted invoice" }).click();
  await expect(page).toHaveURL(/\/sales\/[^/]+\/edit/);
  expect(await db.journal.count()).toBe(startingJournals + 1);
  const salesChain = await db.salesOrder.findFirst({ where: { description: "E2E quotation to order" }, include: { quotation: true, convertedInvoice: true } });
  expect(salesChain?.quotation).toBeTruthy(); expect(salesChain?.convertedInvoice).toBeTruthy(); expect(salesChain?.status).toBe("CONVERTED");

  await page.goto("/purchases/quotations/new");
  await page.getByLabel("Supplier").selectOption({ index: 1 });
  await page.getByLabel("Comparison reference").fill("E2E-OFFICE-QUOTE");
  await page.getByLabel("Quote date").fill("2026-08-24");
  await page.getByLabel("Valid until").fill("2026-09-15");
  await page.getByLabel("Description", { exact: true }).fill("E2E supplier quote to bill");
  await page.locator('input[name="lineDescription"]').fill("Office supplies");
  await page.locator('select[name="lineAccountId"]').selectOption({ index: 1 });
  await page.locator('input[name="lineUnitPrice"]').fill("80");
  await page.getByRole("button", { name: "Save supplier quotation" }).click();
  await expect(page).toHaveURL(/\/purchases\/quotations\//);
  expect(await db.journal.count()).toBe(startingJournals + 1);
  await page.getByRole("button", { name: "Select this supplier quotation" }).click();
  await page.getByRole("button", { name: "Create purchase order" }).click();
  await expect(page).toHaveURL(/\/purchases\/orders\//);
  expect(await db.journal.count()).toBe(startingJournals + 1);
  await page.getByRole("button", { name: "Approve purchase order" }).click();
  await page.locator('input[name="receiveQuantity"]').fill("1");
  await page.getByRole("button", { name: "Record goods received" }).click();
  await expect(page.locator("body")).toContainText("RECEIVED");
  await page.getByRole("button", { name: "Create bill for received quantities" }).click();
  await expect(page).toHaveURL(/\/purchases\/[^/]+\/edit/);
  expect(await db.journal.count()).toBe(startingJournals + 2);
  const purchaseChain = await db.purchaseOrder.findFirst({ where: { description: "E2E supplier quote to bill" }, include: { quotation: true, supplierBills: true } });
  expect(purchaseChain?.quotation).toBeTruthy(); expect(purchaseChain?.supplierBills).toHaveLength(1); expect(purchaseChain?.status).toBe("BILLED");
  await db.$disconnect();
});

test("a credit fixed-asset purchase posts to payables and registers without a second journal", async ({ page }) => {
  const db = new PrismaClient();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/purchases/new");
  await page.getByLabel("Supplier").selectOption({ index: 1 });
  await page.getByLabel("Document date").fill("2026-08-24");
  await page.getByLabel("Due date").fill("2026-09-24");
  await page.getByLabel("Description", { exact: true }).fill("E2E credit fixed asset");
  await page.locator('input[name="lineDescription"]').fill("E2E test freezer");
  const assetAccountId = await page.locator('select[name="lineAccountId"] option').filter({ hasText: /^1500 —/ }).getAttribute("value");
  expect(assetAccountId).toBeTruthy();
  await page.locator('select[name="lineAccountId"]').selectOption(assetAccountId!);
  await page.locator('input[name="lineUnitPrice"]').fill("3600");
  await page.getByRole("button", { name: "Post bill" }).click();
  await expect(page).toHaveURL(/\/purchases\/[^/]+\/edit/);

  const bill = await db.supplierBill.findFirstOrThrow({
    where: { description: "E2E credit fixed asset" },
    include: { lines: true },
  });
  const journal = await db.journal.findUniqueOrThrow({ where: { id: bill.journalId! }, include: { lines: { include: { account: true } } } });
  expect(journal.lines.find((line) => line.account.code === "1500")?.debit.toString()).toBe("3600");
  expect(journal.lines.find((line) => line.account.code === "2000")?.credit.toString()).toBe("3600");
  const journalCount = await db.journal.count();

  await page.goto(`/purchases/${bill.id}/fixed-assets`);
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Register asset" }).click();
  await page.getByLabel("Asset code").fill("E2E-CREDIT-ASSET");
  const accumulatedId = await page.getByLabel("Accumulated depreciation account").locator("option").filter({ hasText: /^1510 —/ }).getAttribute("value");
  const depreciationExpenseId = await page.getByLabel("Depreciation expense account").locator("option").filter({ hasText: /^6900 —/ }).getAttribute("value");
  expect(accumulatedId).toBeTruthy();
  expect(depreciationExpenseId).toBeTruthy();
  await page.getByLabel("Accumulated depreciation account").selectOption(accumulatedId!);
  await page.getByLabel("Depreciation expense account").selectOption(depreciationExpenseId!);
  await page.getByRole("button", { name: "Save asset" }).click();
  await expect(page).toHaveURL(/\/fixed-assets$/);

  const asset = await db.fixedAsset.findFirst({ where: { sourceLineId: bill.lines[0].id } });
  expect(asset?.assetCode).toBe("E2E-CREDIT-ASSET");
  expect(asset?.originalCost.toString()).toBe("3600");
  expect(await db.journal.count()).toBe(journalCount);
  await db.$disconnect();
});
