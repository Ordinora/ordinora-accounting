import { expect, test } from "@playwright/test";

const safeDatabase = (() => { try { return new URL(process.env.E2E_DATABASE_URL ?? "").pathname.replace(/^\//, "").endsWith("_e2e"); } catch { return false; } })();
test.skip(process.env.E2E_ALLOW_ACCOUNTING_WRITES !== "true" || !safeDatabase, "Run only through scripts/run-e2e-cycle.ps1 with a disposable *_e2e database.");

test("posted sales-to-cash and purchase-to-payment cycle reaches financial reports", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/sales/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Document date").fill("2026-08-20");
  await page.getByLabel("Due date").fill("2026-08-31");
  await page.getByLabel("Description", { exact: true }).fill("E2E consulting sale");
  await page.locator('input[name="lineDescription"]').fill("Consulting revenue");
  await page.locator('select[name="lineAccountId"]').selectOption({ index: 1 });
  await page.locator('input[name="lineQuantity"]').fill("1");
  await page.locator('input[name="lineUnitPrice"]').fill("100");
  await page.getByRole("button", { name: "Post invoice" }).click();
  await expect(page).toHaveURL(/\/sales$/);

  await page.goto("/receipts/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Receipt date").fill("2026-08-21");
  await page.getByLabel("Cash or bank account").selectOption({ index: 1 });
  await page.locator('input[name="allocationAmount"]').filter({ visible: true }).fill("100");
  await page.getByRole("button", { name: "Post receipt" }).click();
  await expect(page).toHaveURL(/\/receipts$/);

  await page.goto("/purchases/new");
  await page.getByLabel("Supplier").selectOption({ index: 1 });
  await page.getByLabel("Document date").fill("2026-08-20");
  await page.getByLabel("Due date").fill("2026-08-31");
  await page.getByLabel("Description", { exact: true }).fill("E2E operating expense");
  await page.locator('input[name="lineDescription"]').fill("Office expense");
  await page.locator('select[name="lineAccountId"]').selectOption({ index: 1 });
  await page.locator('input[name="lineQuantity"]').fill("1");
  await page.locator('input[name="lineUnitPrice"]').fill("40");
  await page.getByRole("button", { name: "Post bill" }).click();
  await expect(page).toHaveURL(/\/purchases$/);

  await page.goto("/payments/new/supplier");
  await page.getByLabel("Supplier").selectOption({ index: 1 });
  await page.getByLabel("Payment date").fill("2026-08-22");
  await page.getByLabel("Cash or bank account").selectOption({ index: 1 });
  await page.locator('input[name="allocationAmount"]').filter({ visible: true }).fill("40");
  await page.getByRole("button", { name: "Post payment" }).click();
  await expect(page).toHaveURL(/\/payments$/);

  await page.goto("/reports/income-statement?from=2026-08-01&to=2026-08-31");
  await expect(page.getByRole("heading", { level: 2, name: "Income Statement" })).toBeVisible();
  await expect(page.getByText("Total income").locator("..")).toContainText("BND 1,350.00");
  await expect(page.getByText("Total expenses").locator("..")).toContainText("BND 40.00");
  await expect(page.getByRole("cell", { name: "Sales revenue" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Cost of sales" })).toBeVisible();
  await page.goto("/reports/trial-balance?asOf=2026-08-31");
  await expect(page.locator("body")).toContainText("Trial Balance", { ignoreCase: true });
  await expect(page.locator("body")).toContainText("BALANCED");
});
