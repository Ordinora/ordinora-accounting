import { expect, test } from "@playwright/test";

const password = process.env.E2E_STAFF_PASSWORD!;
const healthToken = process.env.HEALTH_CHECK_TOKEN;

function percentile(values: number[], percentage: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage) - 1)] ?? 0;
}

test("baseline HTTP security headers and authentication boundaries survive forwarded headers", async ({ request }) => {
  const live = await request.get("/api/health/live", { headers: { "x-forwarded-proto": "https", "x-forwarded-host": "accounting.example.invalid" } });
  expect(live.status()).toBe(200);
  expect(live.headers()["cache-control"]).toContain("no-store");
  expect(live.headers()["x-content-type-options"]).toBe("nosniff");
  expect(live.headers()["x-frame-options"]).toBe("DENY");
  expect(live.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");

  for (const route of ["/", "/reports", "/settings/security/sessions", "/portal"]) {
    const response = await request.get(route, { maxRedirects: 0, headers: { "x-forwarded-proto": "https", "x-forwarded-host": "accounting.example.invalid" } });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers().location).toMatch(route === "/portal" ? /\/portal\/login/ : /\/login/);
  }
});

test("readiness remains token protected when a production-style token is configured", async ({ request }) => {
  test.skip(!healthToken, "Set HEALTH_CHECK_TOKEN for proxy readiness acceptance.");
  const denied = await request.get("/api/health/ready");
  expect(denied.status()).toBe(401);
  expect(denied.headers()["cache-control"]).toContain("no-store");
  const allowed = await request.get("/api/health/ready", { headers: { authorization: `Bearer ${healthToken}` } });
  expect(allowed.status()).toBe(200);
  await expect(allowed.json()).resolves.toMatchObject({ status: "ready", checks: { database: true, storage: true } });
});

test("a cross-origin Server Action login submission is rejected", async ({ page, request, baseURL }) => {
  test.skip(!password, "Set E2E_STAFF_PASSWORD for Server Action origin acceptance.");
  await page.goto("/login");
  await page.getByLabel("Email address").fill("accountant@demo.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  let captured: { headers: Record<string, string>; body: Buffer } | undefined;
  await page.route("**/login", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    captured = { headers: await route.request().allHeaders(), body: route.request().postDataBuffer() ?? Buffer.alloc(0) };
    await route.abort("aborted");
  });
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect.poll(() => Boolean(captured)).toBe(true);
  const replayHeaders: Record<string, string> = { ...captured!.headers, origin: "https://untrusted.example.invalid", host: new URL(baseURL!).host };
  delete replayHeaders["content-length"];
  delete replayHeaders["x-forwarded-host"];
  delete replayHeaders.cookie;
  const forged = await request.post("/login", { headers: replayHeaders, data: captured!.body });
  expect(forged.status()).toBe(500);
  expect((await page.context().cookies()).find((cookie) => cookie.name === "ordinora_session")).toBeUndefined();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("concurrent public HTTP traffic stays within the local acceptance threshold", async ({ request }, testInfo) => {
  const concurrentUsers = 20;
  const requestsPerUser = 10;
  const thresholdP95 = 1_500;
  const routes = ["/api/health/live", "/login", "/portal/login"];
  const started = performance.now();
  const settled = await Promise.allSettled(Array.from({ length: concurrentUsers }, async (_, userIndex) => {
    const timings: number[] = [];
    for (let index = 0; index < requestsPerUser; index += 1) {
      const requestStarted = performance.now();
      const response = await request.get(routes[(userIndex + index) % routes.length]);
      expect(response.status()).toBe(200);
      timings.push(Math.round((performance.now() - requestStarted) * 10) / 10);
    }
    return timings;
  }));
  const failures = settled.filter((result) => result.status === "rejected");
  const timings = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const elapsedSeconds = Math.round(((performance.now() - started) / 1000) * 100) / 100;
  const summary = { concurrentUsers, totalRequests: concurrentUsers * requestsPerUser, failures: failures.length, elapsedSeconds, requestsPerSecond: Math.round((timings.length / elapsedSeconds) * 10) / 10, p50: percentile(timings, 0.5), p95: percentile(timings, 0.95), p99: percentile(timings, 0.99), maximum: Math.max(...timings, 0), thresholdP95 };
  console.info(JSON.stringify({ httpAcceptance: summary }));
  await testInfo.attach("http-load-summary", { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  expect(failures).toHaveLength(0);
  expect(summary.p95).toBeLessThanOrEqual(thresholdP95);
});
