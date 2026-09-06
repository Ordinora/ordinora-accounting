import { describe, expect, it } from "vitest";
import { assertTenantAllowsMutation, DormantCompanyError } from "./tenant-status";

describe("dormant company controls", () => {
  it("allows changes for an active company", () => {
    expect(() => assertTenantAllowsMutation({ status: "ACTIVE" })).not.toThrow();
  });

  it("blocks changes for a dormant company", () => {
    expect(() => assertTenantAllowsMutation({ status: "DORMANT" })).toThrow(DormantCompanyError);
  });
});
