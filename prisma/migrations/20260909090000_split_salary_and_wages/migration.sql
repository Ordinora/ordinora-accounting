-- Split the former combined salary/wages presentation without changing account IDs
-- or any journal-line relationships already posted against these account codes.
UPDATE "Account"
SET
  "name" = 'Wages',
  "reportingClassification" = 'Direct Expenses'
WHERE "code" = '5100'
  AND "type" = 'EXPENSE'
  AND "name" = 'Direct labour';

UPDATE "Account"
SET
  "name" = 'Salary',
  "reportingClassification" = 'Indirect Expenses'
WHERE "code" = '6000'
  AND "type" = 'EXPENSE'
  AND "name" = 'Salaries and wages';
