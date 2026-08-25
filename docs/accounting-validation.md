# Accounting validation and acceptance

## Automated close controls

The month-end review is the primary accountant-facing integrity screen. It checks:

- posted debits equal posted credits;
- receivable and payable control accounts agree to their supporting customer and supplier documents;
- inventory ledger value agrees to the movement register;
- FIFO cost-layer quantities and carrying values agree to the inventory register when FIFO is enabled;
- payroll net-pay control agrees to posted payroll less recorded payroll settlements;
- no item-location quantity is negative as of the review date;
- required control accounts are active;
- draft journals, bank-reconciliation coverage, depreciation posting, and accounting-period validity.

These checks detect internal inconsistencies; they do not determine whether a transaction is genuine, correctly classified, tax deductible, compliant with Brunei law, or complete.

## Pre-live accounting gates — 24 August 2026

The following application-level gates are implemented and automated:

- opening receivable and payable allocations are reconciled to their general-ledger control balances, including partial allocations and credit notes;
- inventory costing is selectable by company between weighted average and FIFO;
- FIFO cost layers are used by opening stock, supplier bills, direct inventory payments, sales invoices, daily sales, transfers, stock adjustments, and monthly physical-consumption postings;
- a company with existing weighted-average history can convert prospectively to FIFO using its current quantity and carrying value; the conversion is recorded in the audit trail and is not represented as a retroactive FIFO reconstruction;
- foreign sales, purchases, direct payments, receipts, supplier payments, credit notes, quotations, orders, and inter-account transfers retain transaction currency and base-currency values;
- settlement tests cover partial allocations, currency rounding boundaries, and the debit/credit direction of realized customer and supplier exchange gains and losses.

Automated evidence: the focused reconciliation, FIFO, and currency suite passes 23 tests; TypeScript, scoped ESLint, and the Next.js production build pass. Database migration `20260824182500_fifo_inventory_cost_layers` was applied successfully to the local development database.

Before a live pilot, run the month-end review for each pilot company and resolve every `FAIL`. A `WARNING` requires documented accountant review. Do not switch an established company to FIFO without approving the prospective conversion date and retained weighted-average carrying values.

## Query-performance acceptance

Run `npm.cmd run test:accounting-performance` against a production-like restored and anonymised database. The command selects the active company with the largest journal volume, records journal, journal-line, invoice, bill, and inventory-movement counts, then performs cold and warm read-only ledger, receivable, payable, and inventory queries. It fails when any query exceeds `ACCOUNTING_QUERY_LIMIT_MS` (default 2,000 ms). Record database resources and the generated JSON result in the release evidence; a passing small local dataset is not production-scale acceptance.

The development database is useful for regression only and is not representative of production volume. Final acceptance requires data volumes at or above the expected largest client, concurrent accountant and portal traffic, PostgreSQL query-statistics review, and an agreed 95th-percentile response target.

For a repeatable synthetic baseline, first reset the guarded disposable database, point `DATABASE_URL` to that database, set `PERFORMANCE_FIXTURE_CONFIRM=GENERATE_DISPOSABLE_DATA`, and run `npm.cmd run db:performance-fixture`. The default fixture adds 25,000 balanced posted journals (50,000 lines), 10,000 invoices, 10,000 bills, and 50,000 inventory movements. The four volumes can be changed with `PERFORMANCE_JOURNALS`, `PERFORMANCE_INVOICES`, `PERFORMANCE_BILLS`, and `PERFORMANCE_MOVEMENTS`. The generator refuses databases whose name does not end in `_e2e`, and refuses a second load without a database reset.

### Synthetic baseline evidence — 24 August 2026

The default fixture was loaded successfully into `ordinora_e2e`. Including the original seed, the measured company contained 25,001 journals, 50,002 journal lines, 10,000 sales invoices, 10,000 supplier bills, and 50,000 inventory movements. Against the 2,000 ms per-query threshold, cold timings were 276.3 ms for posted-ledger aggregation, 117.3 ms for receivables, 105.8 ms for payables, and 70.2 ms for inventory aggregation. Warm timings were 251.2 ms, 103.4 ms, 89.1 ms, and 52.0 ms respectively. All checks passed. This is synthetic single-process evidence, not a substitute for anonymised restored-data and concurrent-user acceptance.

## Concurrent read acceptance

Run `npm.cmd run test:accounting-concurrency` against a scaled test database. It starts 20 virtual users by default, with each user performing 12 sequential requests while all users run concurrently. The workload rotates through posted-ledger aggregation, recent journals, receivables, payables, and inventory valuation queries. It reports overall and per-workload p50, p95, p99, maximum latency, throughput, and failures. Configure the run with `ACCOUNTING_CONCURRENT_USERS`, `ACCOUNTING_REQUESTS_PER_USER`, and `ACCOUNTING_CONCURRENT_P95_MS` (default 1,500 ms). This validates database/query concurrency; production HTTP, TLS proxy, and multi-instance load acceptance remain separate deployment checks.

On 24 August 2026, the scaled synthetic dataset passed with 20 concurrent users and 240 completed requests: zero failures, 94.9 requests/second, overall p50 196.2 ms, p95 360.5 ms, p99 551.9 ms, and maximum 592.7 ms. Per-workload p95 was 259.3 ms for ledger aggregation, 223.0 ms for recent journals, 424.9 ms for receivables, 465.2 ms for payables, and 251.3 ms for inventory. The configured overall p95 limit was 1,500 ms.

## Professional sign-off still required

A Brunei-qualified accountant or appropriately qualified adviser must approve the chart-of-account templates, financial-statement presentation, opening-balance conversion, inventory policy, depreciation policy, foreign-currency treatment, payroll/SPK configuration, tax working papers, retention policy, and year-end procedures before real-client production use.
