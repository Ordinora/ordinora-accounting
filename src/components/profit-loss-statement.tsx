import { Prisma } from "@prisma/client";
import { formatCurrencyAmount } from "@/lib/currency";
import type { ProfitLossSection, ProfitLossStatement } from "@/lib/profit-loss";

const money = formatCurrencyAmount;

function Section({ section, currency, title, totalLabel }: { section: ProfitLossSection; currency: string; title: string; totalLabel: string }) {
  const rows = section.rows.filter((row) => !row.amount.eq(0));
  if (!rows.length || section.total.eq(0)) return null;
  return <div className="statement-section"><h3>{title}</h3><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Account</th><th className="numeric">Amount</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td className="numeric">{money(currency,row.amount)}</td></tr>)}<tr className="statement-total"><td colSpan={2}><strong>{totalLabel}</strong></td><td className="numeric"><strong>{money(currency,section.total)}</strong></td></tr></tbody></table></div></div>;
}
function Subtotal({ label, value, currency, showWhenZero = false, final = false }: { label: string; value: Prisma.Decimal; currency: string; showWhenZero?: boolean; final?: boolean }) {
  if (value.eq(0) && !showWhenZero) return null;
  return <div className={`statement-grand-total profit-loss-subtotal${final ? " statement-final-total" : ""}`}><strong>{label}</strong><strong>{money(currency,value)}</strong></div>;
}
export function ProfitLossStatementView({ statement, currency }: { statement: ProfitLossStatement; currency: string }) {
  const hasContraRevenue = !statement.contraRevenue.total.eq(0);
  const hasNonOperatingActivity = !statement.otherIncome.total.eq(0) || !statement.otherExpenses.total.eq(0);
  return <section className="surface-card balance-sheet-statement">
    <Section section={statement.revenue} currency={currency} title="Revenue" totalLabel={hasContraRevenue ? "Total Revenue" : "Net Revenue"}/>
    <Section section={statement.contraRevenue} currency={currency} title="Returns, Allowances & Discounts" totalLabel="Total Returns, Allowances & Discounts"/>
    {hasContraRevenue && <Subtotal label="Net Revenue" value={statement.netRevenue} currency={currency}/>}
    <Section section={statement.cogs} currency={currency} title="Cost of Goods Sold" totalLabel="Total COGS"/>
    <Subtotal label="Gross Profit" value={statement.grossProfit} currency={currency}/>
    <Section section={statement.directExpenses} currency={currency} title="Direct Operating Expenses" totalLabel="Total Direct Expenses"/>
    <Section section={statement.indirectExpenses} currency={currency} title="Operating Expenses" totalLabel="Total Operating Expenses"/>
    <Subtotal label="Operating Income (EBIT)" value={statement.operatingIncome} currency={currency} showWhenZero/>
    <Section section={statement.otherIncome} currency={currency} title="Other Income" totalLabel="Total Other Income"/>
    <Section section={statement.otherExpenses} currency={currency} title="Other Expenses" totalLabel="Total Other Expenses"/>
    {hasNonOperatingActivity && <Subtotal label="Income Before Tax" value={statement.incomeBeforeTax} currency={currency} showWhenZero/>}
    <Section section={statement.taxExpenses} currency={currency} title="Income Tax Expense" totalLabel="Total Income Tax Expense"/>
    <Subtotal label="Net Income / (Loss)" value={statement.netIncome} currency={currency} final/>
  </section>;
}
