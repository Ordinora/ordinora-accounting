-- Complete the CPA-standard P&L classifications for existing companies.
UPDATE "Account" SET "reportingClassification" = 'Cost of Goods Sold (COGS)'
WHERE "type" = 'EXPENSE' AND "code" = '5100';

UPDATE "Account" SET "reportingClassification" = 'Other Expenses'
WHERE "type" = 'EXPENSE' AND lower("reportingClassification") IN (
  'finance costs', 'finance cost', 'other expense', 'other expenses', 'non-operating expenses'
) AND "code" <> '7000';

UPDATE "Account" SET "reportingClassification" = 'Tax Expenses'
WHERE "type" = 'EXPENSE' AND (
  "code" = '7000'
  OR lower("reportingClassification") IN ('income tax', 'tax expense', 'tax expenses')
);
