import { describe, expect, it } from "vitest";
import { clamAvResponseComplete, parseClamAvResponse } from "./clamav-protocol";

describe("ClamAV daemon protocol", () => {
  it("recognizes a null-terminated clean response without waiting for connection close", () => {
    expect(clamAvResponseComplete("stream: OK\0")).toBe(true);
    expect(parseClamAvResponse("stream: OK\0")).toEqual({ clean: true, engine: "clamav-daemon", result: "CLEAN" });
  });

  it("recognizes malware findings", () => {
    expect(parseClamAvResponse("stream: Win.Test.EICAR_HDB-1 FOUND\0")).toMatchObject({ clean: false, result: "MALWARE_DETECTED" });
  });

  it("rejects daemon errors instead of treating them as clean", () => {
    expect(() => parseClamAvResponse("stream: Size limit exceeded. ERROR\0")).toThrow(/invalid response/i);
  });
});
