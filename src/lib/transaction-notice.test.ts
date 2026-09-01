import { describe, expect, it } from "vitest";
import { transactionNoticeMessages, withTransactionNotice } from "./transaction-notice";

describe("transaction notices", () => {
  it("adds a posting code to a plain destination", () => {
    expect(withTransactionNotice("/payments", "payment")).toBe("/payments?posted=payment");
  });

  it("preserves an existing query string", () => {
    expect(withTransactionNotice("/journals/123?view=detail", "manual-journal")).toBe("/journals/123?view=detail&posted=manual-journal");
  });

  it("provides a success message for every supported code", () => {
    expect(Object.values(transactionNoticeMessages).every((message) => message.endsWith(".") && message.length > 10)).toBe(true);
  });
});
