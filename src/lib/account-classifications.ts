export const ACCOUNT_CLASSIFICATIONS = {
  ASSET: ["Cash and cash equivalents", "Current assets", "Non-current assets"],
  LIABILITY: ["Current liabilities", "Employee obligations", "Borrowings", "Non-current liabilities"],
  EQUITY: ["Equity"],
  REVENUE: ["Revenue", "Contra Revenue", "Other Income"],
  EXPENSE: ["Cost of Goods Sold (COGS)", "Direct Expenses", "Indirect Expenses", "Other Expenses", "Tax Expenses"],
} as const;

export function classificationsForAccountType(type: keyof typeof ACCOUNT_CLASSIFICATIONS): readonly string[] {
  return ACCOUNT_CLASSIFICATIONS[type];
}
