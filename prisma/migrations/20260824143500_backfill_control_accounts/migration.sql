-- Protect standard subledger and system-managed accounts in existing companies.
UPDATE "Account"
SET "isControlAccount" = TRUE
WHERE "code" IN ('1200', '1300', '1510', '2000', '2210', '2220', '2230');
