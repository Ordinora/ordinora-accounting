import { financialYearDateRange, type FinancialYearSettings } from "./financial-year";

export type DashboardDateRange = { from: Date; to: Date; fromInput: string; toInput: string };

export function dashboardDateRange(query: { from?: string; to?: string }, settings: FinancialYearSettings, now = new Date()): DashboardDateRange {
  return financialYearDateRange(query, settings, now);
}
