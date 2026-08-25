import { parseMoneyToMinor } from "./accounting";

export type OpeningBalanceInput = { accountId: string; debit: string; credit: string };
export function prepareOpeningBalances(lines: OpeningBalanceInput[]) {
  const prepared = lines.map((line) => ({ accountId: line.accountId, debitMinor: line.debit.trim() ? parseMoneyToMinor(line.debit) : 0n, creditMinor: line.credit.trim() ? parseMoneyToMinor(line.credit) : 0n })).filter((line) => line.debitMinor !== 0n || line.creditMinor !== 0n);
  if (prepared.length < 2) throw new Error("Enter at least two opening balances.");
  if (prepared.some((line) => line.debitMinor < 0n || line.creditMinor < 0n)) throw new Error("Opening balances cannot be negative; use the correct debit or credit column.");
  if (prepared.some((line) => line.debitMinor > 0n && line.creditMinor > 0n)) throw new Error("An account cannot have both a debit and credit opening balance.");
  if (new Set(prepared.map((line) => line.accountId)).size !== prepared.length) throw new Error("Each account can appear only once.");
  const totalDebits = prepared.reduce((sum, line) => sum + line.debitMinor, 0n), totalCredits = prepared.reduce((sum, line) => sum + line.creditMinor, 0n);
  if (totalDebits !== totalCredits) throw new Error(`Opening balances do not balance. Difference: ${(Number(totalDebits - totalCredits) / 100).toFixed(2)}.`);
  if (totalDebits === 0n) throw new Error("Opening balances cannot total zero.");
  return { lines: prepared, totalDebits, totalCredits };
}
