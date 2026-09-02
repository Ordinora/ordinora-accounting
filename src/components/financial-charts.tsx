"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSyncExternalStore } from "react";
import type { AgingChartPoint, BalanceTrendPoint } from "@/lib/balance-trend";

type CustomerPoint = { name: string; outstanding: number };
const palette = { emerald: "#0a4939", copper: "#c67b36", sage: "#4f8b75", sand: "#d9a85e", red: "#b94b43" };
const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const amount = (currency: string, value: number) => `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const hasValues = (values: number[]) => values.some((value) => Math.abs(value) > 0.0001);
const subscribe = () => () => undefined;
const useChartReady = () => useSyncExternalStore(subscribe, () => true, () => false);

function EmptyChart() {
  return <div className="chart-empty">Not enough posted data yet.</div>;
}

function LoadingChart() {
  return <div className="chart-empty">Loading chart…</div>;
}

function ChartCard({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <article className="surface-card chart-card"><div className="chart-heading"><h3>{title}</h3><p>{copy}</p></div><div className="chart-canvas">{children}</div></article>;
}

export function StaffDashboardCharts({ trend, aging, customers, currency, periodLabel }: { trend: BalanceTrendPoint[]; aging: AgingChartPoint[]; customers: CustomerPoint[]; currency: string; periodLabel: string }) {
  const ready = useChartReady();
  const cashAvailable = hasValues(trend.map((row) => row.cash));
  const performanceAvailable = hasValues(trend.flatMap((row) => [row.revenue, row.expense]));
  const agingAvailable = hasValues(aging.flatMap((row) => [row.receivables, row.payables]));
  const customersAvailable = hasValues(customers.map((row) => row.outstanding));
  if (!ready) return <section className="dashboard-chart-grid" aria-label="Financial charts"><ChartCard title="Cash & bank trend" copy={`Closing posted balance · ${periodLabel}`}><LoadingChart/></ChartCard><ChartCard title="Revenue vs expense" copy={`Monthly posted activity · ${periodLabel}`}><LoadingChart/></ChartCard><ChartCard title="Receivables and payables aging" copy="Outstanding documents by existing report bucket"><LoadingChart/></ChartCard><ChartCard title="Top customers by outstanding" copy="Five largest customer balances"><LoadingChart/></ChartCard></section>;
  return <section className="dashboard-chart-grid" aria-label="Financial charts">
    <ChartCard title="Cash & bank trend" copy={`Closing posted balance · ${periodLabel}`}>{cashAvailable ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="periodLabel"/><YAxis tickFormatter={compact}/><Tooltip formatter={(value) => amount(currency, Number(value))}/><Line type="monotone" dataKey="cash" name="Cash & bank" stroke={palette.emerald} strokeWidth={3} dot={{ r: 3 }}/></LineChart></ResponsiveContainer> : <EmptyChart/>}</ChartCard>
    <ChartCard title="Revenue vs expense" copy={`Monthly posted activity · ${periodLabel}`}>{performanceAvailable ? <ResponsiveContainer width="100%" height="100%"><BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="periodLabel"/><YAxis tickFormatter={compact}/><Tooltip formatter={(value) => amount(currency, Number(value))}/><Legend/><Bar dataKey="revenue" name="Revenue" fill={palette.emerald} radius={[5,5,0,0]}/><Bar dataKey="expense" name="Expense" fill={palette.copper} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyChart/>}</ChartCard>
    <ChartCard title="Receivables and payables aging" copy="Outstanding documents by existing report bucket">{agingAvailable ? <ResponsiveContainer width="100%" height="100%"><BarChart data={aging} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="bucket"/><YAxis tickFormatter={compact}/><Tooltip formatter={(value) => amount(currency, Number(value))}/><Legend/><Bar dataKey="receivables" name="Receivables" fill={palette.sage} radius={[5,5,0,0]}/><Bar dataKey="payables" name="Payables" fill={palette.sand} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyChart/>}</ChartCard>
    <ChartCard title="Top customers by outstanding" copy="Five largest customer balances">{customersAvailable ? <ResponsiveContainer width="100%" height="100%"><BarChart data={customers} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="name" width={105}/><Tooltip formatter={(value) => amount(currency, Number(value))}/><Bar dataKey="outstanding" name="Outstanding" fill={palette.copper} radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <EmptyChart/>}</ChartCard>
  </section>;
}

export function PortalFinancialCharts({ trend, aging, currency, showRevenue, showProfit, showReceivables, periodLabel }: { trend: BalanceTrendPoint[]; aging: AgingChartPoint[]; currency: string; showRevenue: boolean; showProfit: boolean; showReceivables: boolean; periodLabel: string }) {
  const ready = useChartReady();
  const trendValues = trend.flatMap((row) => [showRevenue ? row.revenue : 0, showProfit ? row.profit : 0]);
  const receivableAging = aging.map((row) => ({ name: row.bucket === "Current" ? "Current" : "Overdue", value: row.receivables })).reduce<Array<{ name: string; value: number }>>((rows, point) => {
    const existing = rows.find((row) => row.name === point.name);
    if (existing) existing.value += point.value; else rows.push(point);
    return rows;
  }, []);
  if (!ready) return <section className="portal-chart-grid" aria-label="Client financial charts">{(showRevenue || showProfit) && <ChartCard title="Financial trend" copy={`Monthly posted activity · ${periodLabel}`}><LoadingChart/></ChartCard>}{showReceivables && <ChartCard title="Receivables aging" copy="Current versus overdue customer balances"><LoadingChart/></ChartCard>}</section>;
  return <section className="portal-chart-grid" aria-label="Client financial charts">
    {(showRevenue || showProfit) && <ChartCard title={showRevenue && showProfit ? "Revenue and profit trend" : showRevenue ? "Revenue trend" : "Profit trend"} copy={`Monthly posted activity · ${periodLabel}`}>{hasValues(trendValues) ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="periodLabel"/><YAxis tickFormatter={compact}/><Tooltip formatter={(value) => amount(currency, Number(value))}/><Legend/>{showRevenue && <Line type="monotone" dataKey="revenue" name="Revenue" stroke={palette.emerald} strokeWidth={3}/>} {showProfit && <Line type="monotone" dataKey="profit" name="Net profit" stroke={palette.copper} strokeWidth={3}/>}</LineChart></ResponsiveContainer> : <EmptyChart/>}</ChartCard>}
    {showReceivables && <ChartCard title="Receivables aging" copy="Current versus overdue customer balances">{hasValues(receivableAging.map((row) => row.value)) ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={receivableAging} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={3}>{receivableAging.map((row, index) => <Cell key={row.name} fill={index === 0 ? palette.sage : palette.red}/>)}</Pie><Tooltip formatter={(value) => amount(currency, Number(value))}/><Legend/></PieChart></ResponsiveContainer> : <EmptyChart/>}</ChartCard>}
  </section>;
}
