import { describe, expect, it } from "vitest";
import { isSessionActive, shouldTouchSession } from "./session-policy";

const now = new Date("2026-08-23T12:00:00.000Z");

describe("session policy", () => {
  it("accepts a current, recently active session", () => {
    expect(isSessionActive({ now, expiresAt: new Date("2026-08-23T13:00:00.000Z"), lastSeenAt: new Date("2026-08-23T11:50:00.000Z"), revokedAt: null })).toBe(true);
  });

  it("rejects idle, absolutely expired, and revoked sessions", () => {
    expect(isSessionActive({ now, expiresAt: new Date("2026-08-23T13:00:00.000Z"), lastSeenAt: new Date("2026-08-23T11:30:00.000Z"), revokedAt: null })).toBe(false);
    expect(isSessionActive({ now, expiresAt: now, lastSeenAt: new Date("2026-08-23T11:59:00.000Z"), revokedAt: null })).toBe(false);
    expect(isSessionActive({ now, expiresAt: new Date("2026-08-23T13:00:00.000Z"), lastSeenAt: new Date("2026-08-23T11:59:00.000Z"), revokedAt: now })).toBe(false);
  });

  it("touches activity at most once every five minutes", () => {
    expect(shouldTouchSession(new Date("2026-08-23T11:55:00.000Z"), now)).toBe(true);
    expect(shouldTouchSession(new Date("2026-08-23T11:56:00.000Z"), now)).toBe(false);
  });
});
