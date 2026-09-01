import { Prisma } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";

export type PaymentLineInput = { accountId: string; inventoryItemId?: string; inventoryLocationId?: string; description: string; quantity: string; unitPrice: string; discountPercent?: string };
export type PaymentDiscountType = "NONE" | "PERCENT" | "AMOUNT";
const zero = new Prisma.Decimal(0);
function money(value: string) { return new Prisma.Decimal(parseMoneyToMinor(value).toString()).div(100); }

export function calculatePaymentAmounts(lines: PaymentLineInput[], discountType: PaymentDiscountType, discountValueInput: string) {
  if (lines.length < 1 || lines.length > 100) throw new Error("A payment requires between 1 and 100 lines.");
  const beforeDocumentDiscount = lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity);
    if (!quantity.isFinite() || quantity.lte(0) || quantity.decimalPlaces() > 4) throw new Error("Payment quantities must be positive with no more than four decimal places.");
    const unitPrice = money(line.unitPrice);
    if (unitPrice.lt(0)) throw new Error("Payment unit prices cannot be negative.");
    const discountPercent = new Prisma.Decimal(line.discountPercent || 0);
    if (discountPercent.lt(0) || discountPercent.gt(100)) throw new Error("Discount percentages must be between 0 and 100.");
    const grossAmount = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const lineDiscountAmount = grossAmount.mul(discountPercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const subtotal = grossAmount.sub(lineDiscountAmount);
    if (subtotal.lte(0)) throw new Error("Every payment line must have a positive amount.");
    const description = line.description.trim();
    if (!description) throw new Error("Every payment line needs a description.");
    return { accountId: line.accountId, inventoryItemId: line.inventoryItemId?.trim() || undefined, inventoryLocationId: line.inventoryLocationId?.trim() || undefined, description, quantity, unitPrice, discountPercent, lineDiscountAmount, subtotal };
  });
  const foreignSubtotal = beforeDocumentDiscount.reduce((sum, line) => sum.add(line.subtotal), zero);
  const rawDiscountValue = discountValueInput.trim() || "0";
  let discountValue = zero;
  let discountAmount = zero;
  if (discountType === "PERCENT") {
    discountValue = new Prisma.Decimal(rawDiscountValue);
    if (discountValue.lt(0) || discountValue.gt(100) || discountValue.decimalPlaces() > 4) throw new Error("The payment discount percentage must be between 0 and 100.");
    discountAmount = foreignSubtotal.mul(discountValue).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  } else if (discountType === "AMOUNT") {
    discountValue = money(rawDiscountValue);
    discountAmount = discountValue;
  }
  if (discountAmount.gte(foreignSubtotal)) throw new Error("The payment discount must be less than the subtotal.");
  let allocated = zero;
  const prepared = beforeDocumentDiscount.map((line, index) => {
    const documentDiscountAmount = index === beforeDocumentDiscount.length - 1
      ? discountAmount.sub(allocated)
      : line.subtotal.mul(discountAmount).div(foreignSubtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    allocated = allocated.add(documentDiscountAmount);
    const foreignAmount = line.subtotal.sub(documentDiscountAmount);
    if (foreignAmount.lte(0)) throw new Error("The payment discount is too large for one or more lines.");
    return { ...line, documentDiscountAmount, discountAmount: line.lineDiscountAmount.add(documentDiscountAmount), foreignAmount };
  });
  return { lines: prepared, foreignSubtotal, discountType, discountValue, discountAmount, foreignTotal: foreignSubtotal.sub(discountAmount) };
}

export function calculatePaymentLines(lines: PaymentLineInput[]) {
  return calculatePaymentAmounts(lines, "NONE", "0").lines;
}
