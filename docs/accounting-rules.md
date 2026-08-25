# Accounting rules

## Posting invariants

- A journal is tenant-owned and its reference is unique within that tenant.
- A posting transaction validates access, period state, workflow state and debit/credit equality before writing.
- Money is represented as integer minor units in domain calculations and `Decimal(19,4)` at persistence boundaries for future currency precision.
- Each line is exclusively debit or credit and positive. Total debits must equal total credits and the journal must contain at least two lines.
- Posted journals are immutable. Corrections are linked reversals, credit notes, or new adjustments.
- Posting and its audit event occur in one database transaction.
- `LOCKED` and `FINALIZED` periods reject ordinary postings. Period changes are audited.
- Client-visible figures include only posted entries. Published versions are snapshots and are never overwritten.

## Source-document posting

Sales invoice: debit receivables; credit revenue and tax payable where applicable. Receipt: debit bank/cash; credit receivables. Supplier bill: debit expense/asset and recoverable tax where applicable; credit payables. Payment: debit payables; credit bank/cash. Credit notes reverse the appropriate source pattern.

Current-year earnings are calculated for reporting from posted revenue less posted expenses. New companies therefore do not receive a separate Current-year earnings posting account. At an approved year end, profit or loss is transferred through controlled closing entries to retained earnings. Existing account 3200 balances must be reviewed and cleared before that account is deactivated; historical postings are never deleted automatically.

## Brunei demonstration rules requiring professional approval

SPK employee 8.5%; tiered employer parameters described in the product brief; contribution due date on the 15th; corporate income-tax headline rate 18.5%; ECI timing; annual return timing; seven-year retention; and assumptions about personal tax, GST and capital-gains tax are configuration examples only. They are not legal conclusions.
