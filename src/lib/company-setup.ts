import { financialYearEndDate, type FinancialYearSettings } from "./financial-year";

function addMonthsFromAnchor(date: Date, months: number) {
  const month = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay)));
}

/** Creates twelve periods spanning the financial year ending in `endingYear`. */
export function monthlyAccountingPeriods(endingYear: number, settings: FinancialYearSettings = { financialYearEndMonth: 12, financialYearEndDay: 31 }) {
  if (!Number.isInteger(endingYear) || endingYear < 2000 || endingYear > 2100) throw new Error("Financial year ending year must be between 2000 and 2100.");
  const endsOn = financialYearEndDate(endingYear, settings);
  const startsOn = financialYearEndDate(endingYear - 1, settings);
  startsOn.setUTCDate(startsOn.getUTCDate() + 1);

  return Array.from({ length: 12 }, (_, index) => {
    const periodStart = addMonthsFromAnchor(startsOn, index);
    const nextStart = index === 11 ? new Date(endsOn.getTime() + 86_400_000) : addMonthsFromAnchor(startsOn, index + 1);
    return {
      name: periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      startsOn: periodStart,
      endsOn: new Date(nextStart.getTime() - 86_400_000),
      status: "OPEN" as const,
    };
  });
}
