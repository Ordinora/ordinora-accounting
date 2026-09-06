export type FinancialYearSettings = {
  financialYearEndMonth: number;
  financialYearEndDay: number;
};

export type FinancialYearDateRange = {
  from: Date;
  to: Date;
  fromInput: string;
  toInput: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const dateInputValue = (date: Date) => date.toISOString().slice(0, 10);

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validFinancialYearEnd(month: number, day: number) {
  return Number.isInteger(month) && month >= 1 && month <= 12
    && Number.isInteger(day) && day >= 1 && day <= lastDayOfMonth(2000, month);
}

export function financialYearEndDate(year: number, settings: FinancialYearSettings) {
  if (!validFinancialYearEnd(settings.financialYearEndMonth, settings.financialYearEndDay)) {
    throw new Error("Enter a valid financial year-end month and day.");
  }
  const day = Math.min(settings.financialYearEndDay, lastDayOfMonth(year, settings.financialYearEndMonth));
  return new Date(Date.UTC(year, settings.financialYearEndMonth - 1, day));
}

export function currentFinancialYearStart(settings: FinancialYearSettings, asOf = new Date()) {
  const asOfDay = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const endThisYear = financialYearEndDate(asOfDay.getUTCFullYear(), settings);
  const previousEndYear = asOfDay <= endThisYear ? asOfDay.getUTCFullYear() - 1 : asOfDay.getUTCFullYear();
  const start = financialYearEndDate(previousEndYear, settings);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

function parsedDate(value: string | undefined, endOfDay: boolean) {
  if (!value || !datePattern.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) || dateInputValue(date) !== value ? null : date;
}

export function financialYearDateRange(
  query: { from?: string; to?: string },
  settings: FinancialYearSettings,
  now = new Date(),
): FinancialYearDateRange {
  const defaultTo = new Date(now);
  const to = parsedDate(query.to, true) ?? defaultTo;
  let from = parsedDate(query.from, false) ?? currentFinancialYearStart(settings, to);
  if (from > to) from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  return { from, to, fromInput: dateInputValue(from), toInput: dateInputValue(to) };
}
