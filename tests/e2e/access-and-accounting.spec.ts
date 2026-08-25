import { expect, test } from "@playwright/test";

test.describe("public access boundary", () => {
  test("staff login is available", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("unauthenticated users cannot open accounting pages", async ({ page }) => {
    for (const route of ["/", "/accounts", "/journals", "/reports", "/fixed-assets"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
    }
  });

  test("staff and client authentication remain separate", async ({ page }) => {
    await page.goto("/portal/login");
    await expect(page.getByRole("heading", { name: "Client sign in" })).toBeVisible();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});

test.describe("authenticated accounting smoke", () => {
  test.skip(!process.env.E2E_STAFF_EMAIL || !process.env.E2E_STAFF_PASSWORD, "Set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD to run authenticated checks.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(process.env.E2E_STAFF_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_STAFF_PASSWORD!);
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  for (const [route, title] of [
    ["/", "Dashboard"],
    ["/accounts", "Chart of Accounts"],
    ["/journals", "Journal Entries"],
    ["/reports", "Reports"],
    ["/accounting/month-end", "Month-End Review"],
    ["/fixed-assets", "Fixed Assets"],
    ["/fixed-assets/depreciation", "Depreciation Run"],
  ] as const) {
    test(`${title} loads without a runtime failure`, async ({ page }) => {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).toContainText(title, { ignoreCase: true });
      await expect(page.getByText("Runtime Error", { exact: false })).toHaveCount(0);
    });
  }
});
