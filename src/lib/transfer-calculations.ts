import { Prisma } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";

function amount(value: string) { return new Prisma.Decimal(parseMoneyToMinor(value).toString()).div(100); }
export function calculateTransferValues(input: { sourceAmount: string; sourceRate: Prisma.Decimal.Value; destinationAmount: string; destinationRate: Prisma.Decimal.Value }) {
  const sourceAmount = amount(input.sourceAmount), destinationAmount = amount(input.destinationAmount);
  const sourceRate = new Prisma.Decimal(input.sourceRate), destinationRate = new Prisma.Decimal(input.destinationRate);
  if (sourceRate.lte(0) || destinationRate.lte(0)) throw new Error("Exchange rates must be positive.");
  const sourceBaseAmount = sourceAmount.mul(sourceRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const destinationBaseAmount = destinationAmount.mul(destinationRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { sourceAmount, destinationAmount, sourceRate, destinationRate, sourceBaseAmount, destinationBaseAmount, realizedFxBase: sourceBaseAmount.sub(destinationBaseAmount) };
}
