export type PostingLine = Readonly<{
  accountId: string;
  debitMinor: bigint;
  creditMinor: bigint;
}>;

export type PeriodState = "OPEN" | "CLOSED" | "LOCKED" | "FINALIZED";

export class AccountingRuleError extends Error {}

export function parseMoneyToMinor(input: string) {
  const normalized = input.trim().replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new AccountingRuleError("Amounts must be positive with no more than two decimal places.");
  const [major, fractional = ""] = normalized.split(".");
  return BigInt(major) * 100n + BigInt(fractional.padEnd(2, "0"));
}

export function validateBalancedPosting(lines: readonly PostingLine[]) {
  if (lines.length < 2) throw new AccountingRuleError("A journal requires at least two lines.");

  let debits = 0n;
  let credits = 0n;
  for (const line of lines) {
    if (line.debitMinor < 0n || line.creditMinor < 0n) {
      throw new AccountingRuleError("Journal amounts cannot be negative.");
    }
    if ((line.debitMinor === 0n) === (line.creditMinor === 0n)) {
      throw new AccountingRuleError("Each line must contain exactly one positive debit or credit.");
    }
    debits += line.debitMinor;
    credits += line.creditMinor;
  }
  if (debits !== credits) throw new AccountingRuleError("Total debits must equal total credits.");
  return { debitsMinor: debits, creditsMinor: credits };
}

export function assertPeriodAllowsPosting(state: PeriodState) {
  if (state !== "OPEN") throw new AccountingRuleError(`Posting is not allowed in a ${state.toLowerCase()} period.`);
}

export function assertJournalMutable(status: string) {
  if (status === "POSTED" || status === "REVERSED") {
    throw new AccountingRuleError("Posted entries are immutable; create a reversal or adjustment.");
  }
}

export function formatBnd(minor: bigint) {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const major = absolute / 100n;
  const cents = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}B$${major.toLocaleString("en-US")}.${cents}`;
}
