import { Prisma } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";

export type DocumentDiscountType = "NONE" | "PERCENT" | "AMOUNT";
export type CommercialCalculationLine = {
  description: string;
  accountId: string;
  quantity: string;
  unitPrice: string;
  discountPercent?: string;
  itemId?: string;
  locationId?: string;
};

const zero = new Prisma.Decimal(0);

export function calculateCommercialAmounts(lines: CommercialCalculationLine[], discountType: DocumentDiscountType, discountValueInput: string) {
  const beforeDocumentDiscount = lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity);
    if (quantity.lte(0) || quantity.decimalPlaces() > 4) throw new Error("Quantities must be positive with no more than four decimal places.");
    const unitPrice = new Prisma.Decimal(parseMoneyToMinor(line.unitPrice).toString()).div(100);
    const discountPercent = new Prisma.Decimal(line.discountPercent || 0);
    if (discountPercent.lt(0) || discountPercent.gt(100)) throw new Error("Discount percentages must be between 0 and 100.");
    const gross = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const lineDiscountAmount = gross.mul(discountPercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const subtotal = gross.sub(lineDiscountAmount);
    if (subtotal.lte(0)) throw new Error("Every document line must have a positive net amount before the document discount.");
    return { ...line, quantity, unitPrice, discountPercent, lineDiscountAmount, subtotal };
  });
  const foreignSubtotal = beforeDocumentDiscount.reduce((sum, line) => sum.add(line.subtotal), zero);
  const rawDiscountValue = discountValueInput.trim() || "0";
  let discountValue = zero;
  let discountAmount = zero;
  if (discountType === "PERCENT") {
    discountValue = new Prisma.Decimal(rawDiscountValue);
    if (discountValue.lt(0) || discountValue.gt(100) || discountValue.decimalPlaces() > 4) throw new Error("The document discount percentage must be between 0 and 100.");
    discountAmount = foreignSubtotal.mul(discountValue).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  } else if (discountType === "AMOUNT") {
    discountValue = new Prisma.Decimal(parseMoneyToMinor(rawDiscountValue).toString()).div(100);
    discountAmount = discountValue;
  }
  if (discountAmount.gte(foreignSubtotal)) throw new Error("The document discount must be less than the subtotal.");

  let allocated = zero;
  const prepared = beforeDocumentDiscount.map((line, index) => {
    const documentDiscountAmount = index === beforeDocumentDiscount.length - 1
      ? discountAmount.sub(allocated)
      : line.subtotal.mul(discountAmount).div(foreignSubtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    allocated = allocated.add(documentDiscountAmount);
    const foreign = line.subtotal.sub(documentDiscountAmount);
    if (foreign.lte(0)) throw new Error("The document discount is too large for one or more lines.");
    return { ...line, documentDiscountAmount, discountAmount: line.lineDiscountAmount.add(documentDiscountAmount), foreign };
  });
  return { lines: prepared, foreignSubtotal, discountType, discountValue, discountAmount, foreignTotal: foreignSubtotal.sub(discountAmount) };
}
