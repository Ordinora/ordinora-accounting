CREATE TYPE "AccountControlRole" AS ENUM ('TRADE_RECEIVABLES', 'TRADE_PAYABLES');

ALTER TABLE "Account" ADD COLUMN "controlRole" "AccountControlRole";

UPDATE "Account"
SET "controlRole" = 'TRADE_RECEIVABLES', "isControlAccount" = TRUE
WHERE "code" = '1200';

WITH preferred_payables AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "tenantId"
    ORDER BY CASE WHEN "code" = '2000' THEN 0 ELSE 1 END, "id"
  ) AS position
  FROM "Account"
  WHERE "code" IN ('2000', '2100')
)
UPDATE "Account" AS account
SET "controlRole" = 'TRADE_PAYABLES', "isControlAccount" = TRUE
FROM preferred_payables
WHERE account."id" = preferred_payables."id"
  AND preferred_payables.position = 1;

CREATE UNIQUE INDEX "Account_tenantId_controlRole_key" ON "Account"("tenantId", "controlRole");
