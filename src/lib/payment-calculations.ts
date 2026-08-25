import { Prisma } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";

export type PaymentLineInput = { accountId: string; inventoryItemId?: string; inventoryLocationId?: string; description: string; quantity: string; unitPrice: string; discountPercent?: string };
function money(value: string) { return new Prisma.Decimal(parseMoneyToMinor(value).toString()).div(100); }

export function calculatePaymentLines(lines: PaymentLineInput[]) {
  if (lines.length < 1 || lines.length > 100) throw new Error("A payment requires between 1 and 100 lines.");
  return lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity);
    if (!quantity.isFinite() || quantity.lte(0) || quantity.decimalPlaces() > 4) throw new Error("Payment quantities must be positive with no more than four decimal places.");
    const unitPrice = money(line.unitPrice);
    if (unitPrice.lt(0)) throw new Error("Payment unit prices cannot be negative.");
    const discountPercent = new Prisma.Decimal(line.discountPercent || 0);
    if (discountPercent.lt(0) || discountPercent.gt(100)) throw new Error("Discount percentages must be between 0 and 100.");
    const grossAmount = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const discountAmount = grossAmount.mul(discountPercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const foreignAmount = grossAmount.sub(discountAmount);
    if (foreignAmount.lte(0)) throw new Error("Every payment line must have a positive amount.");
    const description = line.description.trim();
    if (!description) throw new Error("Every payment line needs a description.");
    return { accountId: line.accountId, inventoryItemId: line.inventoryItemId?.trim() || undefined, inventoryLocationId: line.inventoryLocationId?.trim() || undefined, description, quantity, unitPrice, discountPercent, discountAmount, foreignAmount };
  });
}
