-- Standardise existing P&L accounts without changing any posted journal lines.
UPDATE "Account" SET "reportingClassification" = 'Revenue'
WHERE "type" = 'REVENUE' AND lower("reportingClassification") IN ('operating revenue', 'revenue');

UPDATE "Account" SET "reportingClassification" = 'Other Income'
WHERE "type" = 'REVENUE' AND (
  lower("reportingClassification") IN ('other income', 'finance income', 'non-operating income')
  OR lower("name") LIKE '%gain%'
);

UPDATE "Account" SET "reportingClassification" = 'Cost of Goods Sold (COGS)'
WHERE "type" = 'EXPENSE' AND (
  lower("reportingClassification") IN ('cost of goods sold (cogs)', 'cost of goods sold', 'cost of sales', 'cogs')
  OR "code" LIKE '50%'
);

UPDATE "Account" SET "reportingClassification" = 'Direct Expenses'
WHERE "type" = 'EXPENSE' AND lower("reportingClassification") IN ('direct costs', 'direct expense', 'direct expenses')
  AND "code" NOT LIKE '50%';

UPDATE "Account" SET "reportingClassification" = 'Indirect Expenses'
WHERE "type" = 'EXPENSE' AND lower("reportingClassification") IN (
  'operating expenses', 'indirect expense', 'indirect expenses', 'finance costs', 'income tax'
);
