import { expect, test } from "@playwright/test";

const password = process.env.E2E_STAFF_PASSWORD!;

async function submitLogin(page: import("@playwright/test").Page, route: string, email: string, attemptedPassword: string, buttonName: string) {
  await page.goto(route);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(attemptedPassword);
  await page.getByRole("button", { name: buttonName }).click();
}

test.describe("authentication throttling", () => {
  test.skip(!password, "Set E2E_STAFF_PASSWORD to run authentication checks.");

  test("staff login is blocked after five failed attempts without revealing account status", async ({ page }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitLogin(page, "/login", "reviewer@demo.invalid", "Incorrect-password!", "Sign in securely");
      await expect(page.locator(".form-error")).toContainText("Email or password is incorrect");
    }

    await submitLogin(page, "/login", "reviewer@demo.invalid", password, "Sign in securely");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator(".form-error")).toContainText("sign-in is temporarily unavailable");
  });

  test("client portal has the same lockout protection", async ({ page }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitLogin(page, "/portal/login", "finance3@demo.invalid", "Incorrect-password!", "Open client portal");
      await expect(page.locator(".form-error")).toContainText("Email or password is incorrect");
    }

    await submitLogin(page, "/portal/login", "finance3@demo.invalid", password, "Open client portal");
    await expect(page).toHaveURL(/\/portal\/login(?:\?|$)/);
    await expect(page.locator(".form-error")).toContainText("sign-in is temporarily unavailable");
  });
});
