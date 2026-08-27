export const bruneiChart = [
  ["1000","Cash on hand","ASSET","Cash and cash equivalents",false],["1100","Cash at bank","ASSET","Cash and cash equivalents",false],["1110","Petty cash","ASSET","Cash and cash equivalents",false],
  ["1200","Trade receivables","ASSET","Current assets",true],["1210","Allowance for doubtful debts","ASSET","Current assets",false],["1300","Inventory","ASSET","Current assets",true],["1400","Prepayments","ASSET","Current assets",false],["1410","Staff advances","ASSET","Current assets",false],
  ["1500","Property, plant and equipment","ASSET","Non-current assets",false],["1510","Accumulated depreciation","ASSET","Non-current assets",true],["1600","Security deposits","ASSET","Non-current assets",false],
  ["2000","Trade payables","LIABILITY","Current liabilities",true],["2200","Accrued expenses","LIABILITY","Current liabilities",false],["2210","Payroll payable","LIABILITY","Employee obligations",true],["2220","SPK contributions payable","LIABILITY","Employee obligations",true],["2230","Corporate income tax payable","LIABILITY","Current liabilities",true],["2300","Short-term borrowings","LIABILITY","Borrowings",false],["2500","Long-term loans","LIABILITY","Non-current liabilities",false],
  ["3000","Share capital / owner capital","EQUITY","Equity"],["3100","Retained earnings","EQUITY","Equity"],["3300","Drawings / distributions","EQUITY","Equity"],
  ["4000","Sales revenue","REVENUE","Revenue"],["4050","Sales returns and allowances","REVENUE","Contra Revenue"],["4060","Sales discounts","REVENUE","Contra Revenue"],["4100","Service revenue","REVENUE","Revenue"],["4200","Other operating income","REVENUE","Other Income"],["4300","Finance income","REVENUE","Other Income"],
  ["4310","Foreign exchange gains (losses)","REVENUE","Other Income"],
  ["5000","Cost of sales","EXPENSE","Cost of Goods Sold (COGS)"],["5050","Freight-in","EXPENSE","Cost of Goods Sold (COGS)"],["5100","Direct labour","EXPENSE","Cost of Goods Sold (COGS)"],["5200","Freight and delivery","EXPENSE","Direct Expenses"],["5300","Other direct operating costs","EXPENSE","Direct Expenses"],
  ["6000","Salaries and wages","EXPENSE","Indirect Expenses"],["6010","Employer SPK contributions","EXPENSE","Indirect Expenses"],["6100","Rent and premises","EXPENSE","Indirect Expenses"],["6200","Utilities","EXPENSE","Indirect Expenses"],["6300","Office and administration","EXPENSE","Indirect Expenses"],["6400","Professional fees","EXPENSE","Indirect Expenses"],["6500","Repairs and maintenance","EXPENSE","Indirect Expenses"],["6600","Travel and transport","EXPENSE","Indirect Expenses"],["6700","Marketing and promotion","EXPENSE","Indirect Expenses"],["6800","Bank charges","EXPENSE","Indirect Expenses"],["6900","Depreciation expense","EXPENSE","Indirect Expenses"],["6910","Interest expense","EXPENSE","Other Expenses"],["7000","Corporate income tax expense","EXPENSE","Tax Expenses"],
  ["6810","Cash over and short","EXPENSE","Indirect Expenses"],
] as const;

export function controlRoleForChartCode(code: string) {
  if (code === "1200") return "TRADE_RECEIVABLES" as const;
  if (code === "2000") return "TRADE_PAYABLES" as const;
  return null;
}
