import { Prisma } from "@prisma/client";

export type SpkBandInput = {
  salaryFrom: Prisma.Decimal;
  salaryTo: Prisma.Decimal | null;
  employeeRatePercent: Prisma.Decimal;
  employerRatePercent: Prisma.Decimal | null;
  employerFixedAmount: Prisma.Decimal | null;
  minimumEmployerAmount: Prisma.Decimal | null;
};

const hundred = new Prisma.Decimal(100);

export function calculateSpk(basicSalary: Prisma.Decimal, bands: SpkBandInput[]) {
  if (basicSalary.isNegative()) throw new Error("SPK salary base cannot be negative.");

  const matches = bands.filter(
    (candidate) =>
      basicSalary.greaterThanOrEqualTo(candidate.salaryFrom) &&
      (!candidate.salaryTo || basicSalary.lessThanOrEqualTo(candidate.salaryTo)),
  );
  if (!matches.length) throw new Error("No effective SPK rate band covers this salary.");
  if (matches.length > 1) throw new Error("More than one effective SPK rate band covers this salary. Review the SPK configuration.");
  const band = matches[0];
  if (band.employeeRatePercent.isNegative() || band.employeeRatePercent.greaterThan(100)) throw new Error("Employee SPK rate must be between 0% and 100%.");
  if (band.employerRatePercent && (band.employerRatePercent.isNegative() || band.employerRatePercent.greaterThan(100))) throw new Error("Employer SPK rate must be between 0% and 100%.");
  if (band.employerFixedAmount?.isNegative() || band.minimumEmployerAmount?.isNegative()) throw new Error("Employer SPK amounts cannot be negative.");
  if (!band.employerFixedAmount && !band.employerRatePercent) throw new Error("The effective SPK band requires an employer rate or fixed amount.");

  const employee = basicSalary
    .mul(band.employeeRatePercent)
    .div(hundred)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  let employer = band.employerFixedAmount
    ? band.employerFixedAmount
    : basicSalary.mul(band.employerRatePercent ?? 0).div(hundred);
  if (band.minimumEmployerAmount && employer.lessThan(band.minimumEmployerAmount)) {
    employer = band.minimumEmployerAmount;
  }

  return {
    employee,
    employer: employer.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    band,
  };
}
