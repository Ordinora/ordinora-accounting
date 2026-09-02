import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("sendEmail", () => {
  it("skips delivery when no provider is configured", async () => {
    delete process.env.EMAIL_PROVIDER;
    expect(await sendEmail({ to: "staff@example.com", subject: "New document", body: "A file arrived.", linkPath: "/settings/portal/documents" })).toEqual({ status: "SKIPPED" });
  });

  it("sends plain-text and HTML through the configured Resend transport", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Ordinora <notifications@example.com>";
    process.env.APP_URL = "https://books.example.com";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmail({ to: "staff@example.com", subject: "New document", body: "A file arrived.", linkPath: "/settings/portal/documents" })).toEqual({ status: "SENT", provider: "resend" });
    const request = fetchMock.mock.calls[0][1];
    const payload = JSON.parse(String(request.body));
    expect(payload.text).toContain("https://books.example.com/settings/portal/documents");
    expect(payload.html).toContain("Open in Ordinora");
  });

  it("returns failure instead of throwing when the transport fails", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Ordinora <notifications@example.com>";
    process.env.APP_URL = "https://books.example.com";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    await expect(sendEmail({ to: "staff@example.com", subject: "Question", body: "A reply arrived.", linkPath: "/portal/questions/1" })).resolves.toMatchObject({ status: "FAILED", provider: "resend" });
  });
});
