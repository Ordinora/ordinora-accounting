import { expect, test } from "@playwright/test";

const password = process.env.E2E_STAFF_PASSWORD!;

test("client uploads are quarantined until a security scan releases them", async ({ page }) => {
  test.skip(!password, "Run through the disposable E2E cycle.");
  await page.goto("/portal/login");
  await page.getByLabel("Email address").fill("documents1@demo.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open client portal" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/portal/documents");

  await page.getByLabel("PDF or image").setInputFiles({ name: "clean-invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 invoice\n%%EOF") });
  await page.getByRole("button", { name: "Send to accountant" }).click();
  await expect(page.getByRole("status")).toContainText("passed the security scan");

  await page.getByLabel("PDF or image").setInputFiles({ name: "active-document.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 /Launch action\n%%EOF") });
  await page.getByRole("button", { name: "Send to accountant" }).click();
  await expect(page.locator(".form-error")).toContainText("quarantined");

  await expect(page.getByRole("row", { name: /clean-invoice\.pdf/ })).toContainText("UPLOADED");
  await expect(page.getByRole("row", { name: /clean-invoice\.pdf/ }).getByRole("link", { name: "Download" })).toBeVisible();
  await expect(page.getByRole("row", { name: /active-document\.pdf/ })).toContainText("QUARANTINED");
  await expect(page.getByRole("row", { name: /active-document\.pdf/ }).getByRole("link", { name: "Download" })).toHaveCount(0);
});
