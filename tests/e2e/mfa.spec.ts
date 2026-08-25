import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const password = process.env.E2E_STAFF_PASSWORD!;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value: string) {
  let bits = "";
  for (const character of value.replace(/\s/g, "")) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000), buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest(), offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function portalLogin(page: import("@playwright/test").Page) {
  await page.goto("/portal/login");
  await page.getByLabel("Email address").fill("documents3@demo.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open client portal" }).click();
}

test("client enrollment makes TOTP mandatory on the next login", async ({ page }) => {
  test.skip(!password, "Run through the disposable E2E cycle.");
  await portalLogin(page);
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/portal/security/mfa");
  await page.getByRole("button", { name: "Start authenticator setup" }).click();
  await expect(page).toHaveURL(/\/portal\/security\/mfa$/);
  const secret = (await page.locator(".form-notice code").textContent())!.trim();
  await page.getByLabel("Six-digit code").fill(currentTotp(secret));
  await page.getByRole("button", { name: "Enable MFA" }).click();
  await expect(page.getByRole("status")).toContainText("recovery codes", { ignoreCase: true });

  await page.goto("/portal");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/portal\/login$/);
  await portalLogin(page);
  await expect(page).toHaveURL(/\/portal\/login\/mfa$/);
  await page.getByLabel("Authenticator or recovery code").fill(currentTotp(secret));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/portal$/);
});
