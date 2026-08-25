import { expect, test } from "@playwright/test";

test("operational health endpoints report liveness and dependency readiness", async ({ request }) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(await live.json()).toMatchObject({ status: "alive", service: "ordinora" });
  const ready = await request.get("/api/health/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toMatchObject({ status: "ready", checks: { configuration: true, database: true, storage: true } });
});
