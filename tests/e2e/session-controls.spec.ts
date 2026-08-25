import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "";
const safeDatabase = (() => {
  try { return new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_e2e"); } catch { return false; }
})();
test.skip(process.env.E2E_ALLOW_ACCOUNTING_WRITES !== "true" || !safeDatabase || !process.env.E2E_STAFF_PASSWORD, "Run only through the disposable E2E cycle.");

const password = process.env.E2E_STAFF_PASSWORD!;

async function login(page: import("@playwright/test").Page, route: string, email: string, button: string) {
  await page.goto(route);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: button }).click();
}

test("a firm administrator can revoke a client session in the same firm", async ({ browser }) => {
  const clientContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  const adminPage = await adminContext.newPage();
  try {
    await login(clientPage, "/portal/login", "finance2@demo.invalid", "Open client portal");
    await expect(clientPage).toHaveURL(/\/portal$/);

    await login(adminPage, "/login", "admin@demo.invalid", "Sign in securely");
    await expect(adminPage).toHaveURL(/\/$/);
    await adminPage.goto("/settings/security/sessions");
    const row = adminPage.getByRole("row").filter({ hasText: "finance2@demo.invalid" });
    await expect(row).toBeVisible();
    await row.getByLabel(/Reason to revoke/).fill("Administrator security test");
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row).toHaveCount(0);

    await clientPage.goto("/portal");
    await expect(clientPage).toHaveURL(/\/portal\/login(?:\?|$)/);
  } finally {
    await clientContext.close();
    await adminContext.close();
  }
});

test("an idle client session is revoked on its next request", async ({ page }) => {
  await login(page, "/portal/login", "documents1@demo.invalid", "Open client portal");
  await expect(page).toHaveURL(/\/portal$/);
  const cookie = (await page.context().cookies()).find((item) => item.name === "ordinora_session");
  expect(cookie?.value).toBeTruthy();

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.session.update({
      where: { tokenHash: createHash("sha256").update(cookie!.value).digest("hex") },
      data: { lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) },
    });
  } finally {
    await prisma.$disconnect();
  }

  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/login(?:\?|$)/);
});

test("deactivating a client user immediately revokes the active portal session", async ({ page }) => {
  await login(page, "/portal/login", "finance1@demo.invalid", "Open client portal");
  await expect(page).toHaveURL(/\/portal$/);
  const cookie = (await page.context().cookies()).find((item) => item.name === "ordinora_session");
  expect(cookie?.value).toBeTruthy();
  const tokenHash = createHash("sha256").update(cookie!.value).digest("hex");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const user = await prisma.user.findFirstOrThrow({ where: { email: "finance1@demo.invalid" } });

  try {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/login(?:\?|$)/);
    await expect.poll(async () => (await prisma.session.findUnique({ where: { tokenHash } }))?.revokedAt).not.toBeNull();
  } finally {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    await prisma.$disconnect();
  }
});

test("disabling a company portal revokes existing client sessions", async ({ page }) => {
  await login(page, "/portal/login", "documents1@demo.invalid", "Open client portal");
  await expect(page).toHaveURL(/\/portal$/);
  const cookie = (await page.context().cookies()).find((item) => item.name === "ordinora_session");
  expect(cookie?.value).toBeTruthy();
  const tokenHash = createHash("sha256").update(cookie!.value).digest("hex");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const user = await prisma.user.findFirstOrThrow({ where: { email: "documents1@demo.invalid" } });
  expect(user.tenantId).toBeTruthy();

  try {
    await prisma.tenant.update({ where: { id: user.tenantId! }, data: { portalEnabled: false } });
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/login(?:\?|$)/);
    await expect.poll(async () => (await prisma.session.findUnique({ where: { tokenHash } }))?.revokedAt).not.toBeNull();

    await prisma.tenant.update({ where: { id: user.tenantId! }, data: { portalEnabled: true } });
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/login(?:\?|$)/);
  } finally {
    await prisma.tenant.update({ where: { id: user.tenantId! }, data: { portalEnabled: true } });
    await prisma.$disconnect();
  }
});
