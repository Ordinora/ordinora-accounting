export type DashboardDateRange = { from: Date; to: Date; fromInput: string; toInput: string };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const inputValue = (date: Date) => date.toISOString().slice(0, 10);

function parsedDate(value: string | undefined, endOfDay: boolean) {
  if (!value || !datePattern.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) || inputValue(date) !== value ? null : date;
}

export function dashboardDateRange(query: { from?: string; to?: string }, now = new Date()): DashboardDateRange {
  const defaultTo = new Date(now);
  const defaultFrom = new Date(Date.UTC(defaultTo.getUTCFullYear(), defaultTo.getUTCMonth() - 5, 1));
  const to = parsedDate(query.to, true) ?? defaultTo;
  let from = parsedDate(query.from, false) ?? defaultFrom;

  if (from > to) from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const earliest = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 11, 1));
  if (from < earliest) from = earliest;

  return { from, to, fromInput: inputValue(from), toInput: inputValue(to) };
}
