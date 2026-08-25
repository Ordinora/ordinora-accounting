function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

export function corporateTaxReturnDueDate(yearOfAssessment: number) {
  if (!Number.isInteger(yearOfAssessment) || yearOfAssessment < 2000 || yearOfAssessment > 2100) {
    throw new Error("Year of assessment must be between 2000 and 2100.");
  }
  return utcDate(yearOfAssessment, 5, 30);
}

export function estimatedChargeableIncomeDueDate(accountingPeriodEnd: Date) {
  if (Number.isNaN(accountingPeriodEnd.getTime())) throw new Error("Accounting-period end date is invalid.");
  const year = accountingPeriodEnd.getUTCFullYear();
  const month = accountingPeriodEnd.getUTCMonth();
  const day = accountingPeriodEnd.getUTCDate();
  const targetMonthIndex = month + 3;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = utcDate(targetYear, targetMonth + 1, 0).getUTCDate();
  return utcDate(targetYear, targetMonth, Math.min(day, lastDay));
}

export function taxPeriodsOverlap(a: { startsOn: Date; endsOn: Date }, b: { startsOn: Date; endsOn: Date }) {
  return a.startsOn <= b.endsOn && a.endsOn >= b.startsOn;
}
