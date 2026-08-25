import { Prisma, SalesQuotationStatus } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";

export type QuotationLineInput = {
  description: string;
  accountId: string;
  quantity: string;
  unitPrice: string;
  discountPercent?: string;
  itemId?: string;
  locationId?: string;
};

export function calculateQuotationLines(lines: QuotationLineInput[]) {
  if (lines.length < 1 || lines.length > 50) throw new Error("A quotation requires between 1 and 50 lines.");
  return lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity);
    if (quantity.lte(0) || quantity.decimalPlaces() > 4) throw new Error("Quantities must be positive with no more than four decimal places.");
    const unitPrice = new Prisma.Decimal(parseMoneyToMinor(line.unitPrice).toString()).div(100);
    const discountPercent = new Prisma.Decimal(line.discountPercent || 0);
    if (discountPercent.lt(0) || discountPercent.gt(100)) throw new Error("Discount percentages must be between 0 and 100.");
    const gross = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const discountAmount = gross.mul(discountPercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const lineTotal = gross.sub(discountAmount);
    if (lineTotal.lte(0)) throw new Error("Every quotation line must have a positive net amount.");
    return { ...line, quantity, unitPrice, discountPercent, discountAmount, lineTotal };
  });
}

const transitions: Record<SalesQuotationStatus, SalesQuotationStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"], SENT: ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["CONVERTED", "CANCELLED"], DECLINED: [], EXPIRED: [], CONVERTED: [], CANCELLED: [],
};

export function assertQuotationTransition(from: SalesQuotationStatus, to: SalesQuotationStatus) {
  if (!transitions[from].includes(to)) throw new Error(`A ${from.toLowerCase()} quotation cannot be changed to ${to.toLowerCase()}.`);
}
