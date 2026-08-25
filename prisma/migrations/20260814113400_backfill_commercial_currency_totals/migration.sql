UPDATE "SalesInvoice" invoice
SET "foreignTotal" = totals.amount,
    "baseTotal" = totals.amount,
    "exchangeRate" = 1
FROM (
  SELECT "invoiceId", COALESCE(SUM("lineTotal"), 0) AS amount
  FROM "SalesInvoiceLine"
  GROUP BY "invoiceId"
) totals
WHERE invoice.id = totals."invoiceId" AND invoice."foreignTotal" = 0;

UPDATE "SupplierBill" bill
SET "foreignTotal" = totals.amount,
    "baseTotal" = totals.amount,
    "exchangeRate" = 1
FROM (
  SELECT "billId", COALESCE(SUM("lineTotal"), 0) AS amount
  FROM "SupplierBillLine"
  GROUP BY "billId"
) totals
WHERE bill.id = totals."billId" AND bill."foreignTotal" = 0;
