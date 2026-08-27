import { Prisma } from "@prisma/client";
import type { LedgerBalanceRow } from "./financial-statements";
import type { PdfSection } from "./report-pdf";

const zero = new Prisma.Decimal(0);

export type BalanceSheetStatement = ReturnType<typeof import("./financial-statements").calculateBalanceSheet>;
export type BalanceSheetDisplayRow = { code: string; name: string; amount: Prisma.Decimal };

export type BalanceSheetPresentation = {
  currentAssets: BalanceSheetDisplayRow[];
  nonCurrentAssets: BalanceSheetDisplayRow[];
  fixedAssets: BalanceSheetDisplayRow[];
  otherNonCurrentAssets: BalanceSheetDisplayRow[];
  currentLiabilities: BalanceSheetDisplayRow[];
  nonCurrentLiabilities: BalanceSheetDisplayRow[];
  equity: BalanceSheetDisplayRow[];
  totalCurrentAssets: Prisma.Decimal;
  netFixedAssets: Prisma.Decimal;
  totalNonCurrentAssets: Prisma.Decimal;
  totalCurrentLiabilities: Prisma.Decimal;
  totalNonCurrentLiabilities: Prisma.Decimal;
};

const sum = (rows: BalanceSheetDisplayRow[]) => rows.reduce((total, row) => total.add(row.amount), zero);
const normalized = (value: string) => value.trim().toLowerCase();

function isCurrentAsset(row: LedgerBalanceRow) {
  const classification = normalized(row.classification);
  if (classification.includes("non-current") || classification.includes("non current")) return false;
  return classification.includes("cash and cash equivalents") || classification.includes("current asset") || classification.includes("inventory") || classification.includes("prepaid");
}

function isFixedAsset(row: LedgerBalanceRow) {
  const classification = normalized(row.classification);
  const name = normalized(row.name);
  return classification.includes("property plant") || classification.includes("fixed asset") || name.includes("equipment") || name.includes("furniture") || name.includes("accumulated depreciation") || /^15\d\d$/.test(row.code);
}

function isNonCurrentLiability(row: LedgerBalanceRow) {
  const classification = normalized(row.classification);
  // TODO: Split borrowings between current and non-current liabilities once loan term and maturity data is tracked.
  // Until then, every loan/borrowing account defaults to non-current.
  return classification.includes("non-current") || classification.includes("borrowing") || normalized(row.name).includes("loan");
}

export function buildBalanceSheetPresentation(statement: BalanceSheetStatement): BalanceSheetPresentation {
  const assetRows = statement.assets.filter((row) => !row.balance.eq(0));
  const currentAssets = assetRows.filter(isCurrentAsset).map((row) => ({ code: row.code, name: row.name, amount: row.balance }));
  const nonCurrentSource = assetRows.filter((row) => !isCurrentAsset(row));
  const fixedAssets = nonCurrentSource.filter(isFixedAsset).map((row) => {
    // Accumulated depreciation is intentionally rendered as a negative value. It is a contra-asset
    // (credit-balance) account that nets down Kitchen Equipment and Furniture; never convert it to positive.
    return { code: row.code, name: row.name, amount: row.balance };
  });
  const otherNonCurrentAssets = nonCurrentSource.filter((row) => !isFixedAsset(row)).map((row) => ({ code: row.code, name: row.name, amount: row.balance }));
  const nonCurrentAssets = [...fixedAssets, ...otherNonCurrentAssets];

  const liabilityRows = statement.liabilities
    .map((row) => ({ source: row, amount: row.credit.sub(row.debit) }))
    .filter(({ amount }) => !amount.eq(0));
  const currentLiabilities = liabilityRows.filter(({ source }) => !isNonCurrentLiability(source)).map(({ source, amount }) => ({ code: source.code, name: source.name, amount }));
  const nonCurrentLiabilities = liabilityRows.filter(({ source }) => isNonCurrentLiability(source)).map(({ source, amount }) => ({ code: source.code, name: source.name, amount }));
  const equity = statement.equity
    .map((row) => ({ code: row.code, name: row.name, amount: row.credit.sub(row.debit) }))
    .filter((row) => !row.amount.eq(0));

  return {
    currentAssets,
    nonCurrentAssets,
    fixedAssets,
    otherNonCurrentAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    equity,
    totalCurrentAssets: sum(currentAssets),
    netFixedAssets: sum(fixedAssets),
    totalNonCurrentAssets: sum(nonCurrentAssets),
    totalCurrentLiabilities: sum(currentLiabilities),
    totalNonCurrentLiabilities: sum(nonCurrentLiabilities),
  };
}

export function balanceSheetPdfSections(statement: BalanceSheetStatement, amount: (value: Prisma.Decimal) => string): PdfSection[] {
  const view = buildBalanceSheetPresentation(statement);
  const rows = (items: BalanceSheetDisplayRow[]) => items.map((row) => ({ label: `${row.code}  ${row.name}`, amount: amount(row.amount) }));
  const fixedAssetsAreTheWholeSection = view.fixedAssets.length > 0 && view.otherNonCurrentAssets.length === 0;
  const nonCurrentRows = [
    ...rows(view.fixedAssets),
    ...(view.fixedAssets.length ? [{ label: "Net Fixed Assets", amount: amount(view.netFixedAssets), strong: true }] : []),
    ...rows(view.otherNonCurrentAssets),
    ...(!fixedAssetsAreTheWholeSection ? [{ label: "Total Non-Current Assets", amount: amount(view.totalNonCurrentAssets), strong: true }] : []),
  ];
  const equityRows = [
    ...rows(view.equity),
    ...(!statement.currentEarnings.eq(0) ? [{ label: "Net Income / (Loss)", amount: amount(statement.currentEarnings) }] : []),
    { label: "Total Equity", amount: amount(statement.totalEquity), strong: true },
    { label: "Total Liabilities & Equity", amount: amount(statement.totalLiabilitiesAndEquity), strong: true },
  ];

  return [
    ...(view.currentAssets.length ? [{ title: "Current Assets", rows: [...rows(view.currentAssets), { label: "Total Current Assets", amount: amount(view.totalCurrentAssets), strong: true }] }] : []),
    ...(view.nonCurrentAssets.length ? [{ title: "Non-Current Assets", rows: nonCurrentRows }] : []),
    { rows: [{ label: "Total Assets", amount: amount(statement.totalAssets), strong: true }] },
    ...(view.currentLiabilities.length ? [{ title: "Current Liabilities", rows: [...rows(view.currentLiabilities), { label: "Total Current Liabilities", amount: amount(view.totalCurrentLiabilities), strong: true }] }] : []),
    ...(view.nonCurrentLiabilities.length ? [{ title: "Non-Current Liabilities", rows: [...rows(view.nonCurrentLiabilities), { label: "Total Non-Current Liabilities", amount: amount(view.totalNonCurrentLiabilities), strong: true }] }] : []),
    { rows: [{ label: "Total Liabilities", amount: amount(statement.totalLiabilities), strong: true }] },
    { title: "Equity", rows: equityRows },
  ];
}
