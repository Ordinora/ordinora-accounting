import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

const safeDatabase = (() => { try { return new URL(process.env.E2E_DATABASE_URL ?? "").pathname.replace(/^\//, "").endsWith("_e2e"); } catch { return false; } })();
test.skip(process.env.E2E_ALLOW_ACCOUNTING_WRITES !== "true" || !safeDatabase, "Run only through scripts/run-e2e-cycle.ps1 with a disposable *_e2e database.");

test("250-item physical count posts weighted-average consumption without negative stock", async ({ page }) => {
  const db = new PrismaClient();
  const tenant = await db.tenant.findFirstOrThrow();
  const accounts = await db.account.findMany({ where: { tenantId: tenant.id, code: { in: ["1300", "4000", "5000"] } } });
  const account = (code: string) => accounts.find((row) => row.code === code)?.id ?? (() => { throw new Error(`Seed account ${code} is missing.`); })();
  const location = await db.inventoryLocation.create({ data: { tenantId: tenant.id, code: "E2E-VOLUME", name: "E2E volume warehouse", isActive: true } });

  await db.inventoryItem.createMany({ data: Array.from({ length: 250 }, (_, index) => ({
    tenantId: tenant.id,
    sku: `E2E-${String(index + 1).padStart(4, "0")}`,
    name: `E2E volume item ${index + 1}`,
    unitName: "unit",
    inventoryAccountId: account("1300"),
    revenueAccountId: account("4000"),
    cogsAccountId: account("5000"),
    isActive: true,
  })) });
  const items = await db.inventoryItem.findMany({ where: { tenantId: tenant.id, sku: { startsWith: "E2E-" } }, orderBy: { sku: "asc" } });
  await db.inventoryBalance.createMany({ data: items.map((item) => ({ itemId: item.id, locationId: location.id, quantity: new Prisma.Decimal(100), inventoryValue: new Prisma.Decimal(250) })) });
  const staff = await db.user.findFirstOrThrow({ where: { firmId: tenant.firmId, kind: "STAFF" } });
  await db.inventoryMovement.createMany({ data: items.map((item) => ({ tenantId: tenant.id, itemId: item.id, locationId: location.id, type: "OPENING", movementDate: new Date("2026-07-31T00:00:00.000Z"), quantity: new Prisma.Decimal(100), unitCost: new Prisma.Decimal(2.5), totalCost: new Prisma.Decimal(250), reference: "E2E-OPENING-INVENTORY", sourceType: "OpeningInventory", sourceId: "E2E-OPENING-INVENTORY", createdById: staff.id })) });

  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/inventory/consumption");
  await page.getByRole("button", { name: "CSV upload" }).click();
  await page.getByLabel("Count / consumption date").fill("2026-08-24");
  await page.getByLabel("Description").fill("E2E volume monthly consumption");
  const csv = ["SKU,Location,ClosingQuantity", ...items.map((item) => `${item.sku},${location.code},90`)].join("\n");
  await page.getByLabel("Closing-stock CSV").setInputFiles({ name: "closing-stock.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Post consumption" }).click();
  await expect(page).toHaveURL(/\/inventory\/movements$/, { timeout: 30_000 });

  const journal = await db.journal.findFirstOrThrow({ where: { tenantId: tenant.id, description: "E2E volume monthly consumption" }, include: { lines: true } });
  const movements = await db.inventoryMovement.findMany({ where: { tenantId: tenant.id, reference: journal.reference } });
  const balances = await db.inventoryBalance.findMany({ where: { locationId: location.id } });
  const debits = journal.lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
  const credits = journal.lines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0));

  expect(journal.lines).toHaveLength(500);
  expect(movements).toHaveLength(250);
  expect(balances).toHaveLength(250);
  expect(balances.every((row) => row.quantity.eq(90) && row.inventoryValue.eq(225))).toBe(true);
  expect(movements.every((row) => row.quantity.eq(-10) && row.totalCost.eq(-25))).toBe(true);
  expect(debits.toString()).toBe("6250");
  expect(credits.toString()).toBe("6250");

  await page.goto("/reports/inventory-quantity-summary?from=2026-08-01&to=2026-08-24");
  await expect(page.getByLabel("From")).toHaveValue("2026-08-01");
  await expect(page.getByLabel("To")).toHaveValue("2026-08-24");
  await expect(page.getByRole("columnheader", { name: "Opening" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Qty in" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Qty out" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Closing", exact: true })).toBeVisible();
  const firstItem = page.getByRole("row").filter({ hasText: "E2E-0001" });
  await expect(firstItem).toContainText("10");
  await expect(firstItem).toContainText("90");
  const pdf = await page.request.get("/reports/inventory-quantity-summary/pdf?from=2026-08-01&to=2026-08-24");
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  await db.$disconnect();
});
