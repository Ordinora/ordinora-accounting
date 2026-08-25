import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

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
const password = process.env.E2E_STAFF_PASSWORD!;

async function loginStaff(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function loginClient(page: import("@playwright/test").Page, email: string) {
  await page.goto("/portal/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open client portal" }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

test.afterAll(async () => prisma.$disconnect());

test("staff cannot open a record belonging to another accounting firm", async ({ page }) => {
  const foreignFirm = await prisma.firm.create({ data: { name: "E2E Foreign Firm" } });
  const foreignTenant = await prisma.tenant.create({
    data: {
      firmId: foreignFirm.id,
      legalName: "E2E Foreign Company",
      registrationNumber: "E2E-FOREIGN-001",
      entityType: "PRIVATE_LIMITED",
      financialYearEndMonth: 12,
      financialYearEndDay: 31,
    },
  });
  const foreignAccount = await prisma.account.create({
    data: {
      tenantId: foreignTenant.id,
      code: "9999",
      name: "Foreign confidential account",
      type: "ASSET",
      reportingClassification: "Other assets",
    },
  });

  await loginStaff(page);
  const response = await page.goto(`/accounts/${foreignAccount.id}/edit`);
  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).not.toContainText("Foreign confidential account");
});

test("client sessions cannot enter staff accounting pages", async ({ page }) => {
  await loginClient(page, "finance1@demo.invalid");
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("staff sessions cannot enter the client portal", async ({ page }) => {
  await loginStaff(page);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/login(?:\?|$)/);
});

test("a client cannot open another company's published report", async ({ page }) => {
  const otherTenant = await prisma.tenant.findFirstOrThrow({
    where: { legalName: "Temburong Craft Studio (Demo)" },
  });
  const otherReport = await prisma.reportVersion.findFirstOrThrow({
    where: { tenantId: otherTenant.id, state: "PUBLISHED" },
  });

  await loginClient(page, "finance1@demo.invalid");
  const response = await page.goto(`/portal/reports/${otherReport.id}`);
  expect(response?.status()).toBe(404);
});

test("document-only clients cannot open live financial drill-downs", async ({ page }) => {
  await loginClient(page, "documents2@demo.invalid");
  await page.goto("/portal/live/profit");
  await expect(page).toHaveURL(/\/portal$/);
});
