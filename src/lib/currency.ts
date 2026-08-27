import { Prisma } from "@prisma/client";

export function normalizeCurrencyCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Currency code must contain exactly three letters.");
  return code;
}

export function validateExchangeRate(value: string | Prisma.Decimal) {
  const rate = new Prisma.Decimal(value);
  if (!rate.isFinite() || rate.lte(0) || rate.decimalPlaces() > 12) {
    throw new Error("Exchange rate must be positive with no more than 12 decimal places.");
  }
  return rate;
}

export function convertForeignToBase(amount: Prisma.Decimal, rate: Prisma.Decimal, decimalPlaces = 2) {
  return amount.mul(rate).toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateSettlementValues(amount: Prisma.Decimal, originalRate: Prisma.Decimal, settlementRate: Prisma.Decimal) {
  const carryingBase = convertForeignToBase(amount, originalRate);
  const settlementBase = convertForeignToBase(amount, settlementRate);
  return { carryingBase, settlementBase, difference: settlementBase.sub(carryingBase) };
}

export function realizedFxPosting(kind: "RECEIPT" | "PAYMENT", difference: Prisma.Decimal) {
  const isDebit = kind === "RECEIPT" ? difference.lt(0) : difference.gt(0);
  return { debit: isDebit ? difference.abs() : new Prisma.Decimal(0), credit: isDebit ? new Prisma.Decimal(0) : difference.abs() };
}

export function formatCurrencyAmount(currency: string, value: unknown) {
  const numeric = Number(value);
  const formatted = Math.abs(numeric).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return numeric < 0 ? `${currency} (${formatted})` : `${currency} ${formatted}`;
}
