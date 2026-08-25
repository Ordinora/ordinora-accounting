# Implementation plan

## Current position

The six original functional milestones are implemented to development-test level. The project is now in accounting validation, end-to-end verification, security hardening, and production-readiness work. It must not yet be used as a production statutory, payroll, or tax system.

## Milestone status

1. Internal accounting foundation — substantially complete; continue exception-path and full-cycle tests.
2. Client portal foundation — implemented; production security and permission testing pending.
3. Live and published reporting — implemented; immutable snapshot and supersession behavior are browser-verified, while production-scale performance and accountant sign-off remain pending.
4. Inventory and weighted-average costing — implemented; weighted-average and negative-stock calculation boundaries plus a 250-item CSV month-end browser scenario are verified, while restored production-scale volume testing remains pending.
5. Payroll and configurable SPK — standard public TAP contribution bands verified and calculation boundaries covered by automated tests; eligibility, exceptional cases, and Brunei-qualified sign-off remain pending.
6. Tax and compliance — working-paper foundation implemented; 30 June annual-return and three-month ECI deadline controls added, with tax-period overlap validation. Chargeable-income computation, category-specific capital-allowance rules, electronic filing, and professional sign-off remain incomplete.

Additional fixed-asset registration, reconciliation, depreciation, and disposal workflows are implemented.

## Commercial-document phase — implemented

After the active security and posting-hardening gate:

1. Sales quotations with draft, sent, accepted, declined, and expired states.
2. Sales orders created directly or converted from accepted quotations.
3. Purchase quotations / supplier quote comparisons.
4. Purchase orders with partial receipt and billing status.
5. Controlled quotation → order → invoice and purchase order → supplier bill conversion, preserving source links and preventing duplicate posting.

Quotations and orders are non-ledger documents. Accounting entries arise only when an invoice, supplier bill, receipt, payment, or other posting document is created.

## Active phase: verification and hardening

- Full automated regression gate (24 August 2026) — complete: lint, TypeScript checking, Prisma schema validation, migration status, 113 unit/integration tests, and the disposable-database browser suite passed. The browser run completed 18 applicable scenarios with one environment-dependent readiness-token scenario skipped; a local HTTP p95 threshold miss (1,746.5 ms versus 1,500 ms) was immediately isolated and passed at 1,364.9 ms with zero failed requests, identifying it as transient workstation load rather than a reproducible application regression.
- Staging deployment packaging (24 August 2026) — complete locally: Next.js standalone output, a non-root multi-stage container, production configuration validation command, controlled `prisma migrate deploy` command, staging secret-variable template, Docker build exclusions, and a release/acceptance/rollback runbook are in place. Lint, TypeScript, focused operational-configuration tests, and the optimized standalone build pass. Provisioning the actual PostgreSQL, HTTPS proxy, Azure Blob container, ClamAV, secret manager, monitoring, and backup schedule remains environment-specific deployment work.

- Playwright access-boundary and authenticated critical-page smoke suite — complete.
- Full accounting-cycle browser test with a dedicated disposable database — complete for sales invoice, customer receipt, supplier bill, supplier payment, income statement, and balanced trial balance.
- Tenant/IDOR browser matrix for staff and client roles — complete for cross-firm records, staff/client session separation, cross-company published reports, and document-only financial restrictions.
- Concurrent posting, retry, and idempotency tests — complete for duplicate invoices and competing receipt allocations; serialized retries and friendly duplicate-reference validation are enabled for commercial documents and settlements.
- Production build and deployment rehearsal — complete for optimized compilation, disposable-database startup, public access boundaries, and authenticated critical-page smoke checks.
- Authentication rate limiting — complete for staff and client sign-in, including generic failure responses, account/source throttles, audit metadata, and browser regression coverage.
- Session lifecycle hardening — complete for thirty-minute idle expiry, eight-hour absolute expiry, throttled activity tracking, and audited firm-scoped administrator revocation.
- Server Action CSRF posture — reviewed against Next.js 16 same-origin protections and browser-verified locally with a raw forged-origin Server Action replay. Forwarded-header authentication boundaries and a 20-user HTTP baseline pass; the actual production TLS proxy must still verify Host/Origin preservation, request limits, rate limits, and keep-alive settings.
- Authenticator MFA — implemented for staff and client accounts with encrypted secrets, time-limited challenges, one-time recovery codes, audit events, and browser regression coverage; production key management and recovery administration remain pending.
- File quarantine and download hardening — implemented with structural validation, isolated pending storage, basic development scanning, optional ClamAV execution, audited quarantine, and blocked processing/downloads; production scanner deployment and private object-storage adapter remain pending.
- Database-and-document backup packaging, checksum verification, and guarded restore rehearsal — implemented and successfully rehearsed against `ordinora_restore_test`; production scheduling, encryption, retention, and off-host copies remain deployment work.
- Operational monitoring foundation — complete for liveness/readiness endpoints, redacted structured server logs, production configuration validation, and browser verification; external log collection, alert routing, and production dashboard provisioning remain deployment work.
- Private object storage and deployment key management — complete for an Azure Blob provider, tenant-scoped private objects, provider-aware readiness, fail-closed production validation, and transitional MFA key rotation; cloud provisioning, secret-manager connection, native blob backups, and rotation rehearsal remain deployment work.
- Accounting integrity and performance acceptance foundation — complete for expanded month-end controls, report-query indexes, a guarded synthetic-volume generator, repeatable read-only timing, and concurrent database-query acceptance. The scaled baseline passed both single-process thresholds and a 20-user / 240-request run at 360.5 ms overall p95 with zero failures; anonymised restored-data, production HTTP/proxy load testing, and Brunei-qualified sign-off remain release work.
- Commercial quotations and orders — implemented with source-chain preservation, partial purchase-order receipt/billing, and a dedicated non-ledger-to-posting browser acceptance test.
- Credit fixed-asset purchases — supplier bills, supplier quotations, and purchase orders accept permitted asset accounts while protecting cash, receivables, and inventory controls. Browser acceptance covers the debit-to-asset / credit-to-payables posting and verifies that subsequent asset registration creates no duplicate journal.
- Inventory costing acceptance — weighted-average receipts, partial/full issues, currency rounding, physical-closing consumption, and negative-stock rejection have deterministic calculation coverage. A disposable-database browser test also verifies a 250-item CSV count, 250 movements, 500 balanced journal lines, closing quantities, residual values, and COGS totals.
- Published-report integrity — browser-verified for accountant publication, immutable client-visible snapshots after later ledger postings, explicit republication, supersession of the prior version, and finance-viewer access to only the current published version.
- Financial-statement presentation — mixed cash journals now split counterpart amounts across operating, investing, and financing activities instead of assigning the entire journal to one category; broader professional presentation sign-off remains pending.
- Cash-flow navigation integrity — split activity rows preserve the original journal identifier, so every report reference continues to open its connected posted journal.
- Balance-sheet earnings integrity — the month-end review now blocks close readiness when a Current-year earnings equity balance coexists with open revenue or expense balances, preventing silent duplicate-earnings presentation.
- Default chart refinement — new companies no longer receive account 3200 Current-year earnings; reports derive current earnings from posted revenue and expenses, while existing companies retain their historical account for controlled review and deactivation.
- Brunei-qualified review of employee SPK eligibility and exceptional wage arrangements, payroll, tax, capital allowances, and financial-statement presentation — pending. Standard public SPK contribution bands and calculation boundaries have been checked in development.

## Release gate

Production use requires successful migrations against a clean production-like database, repeatable seed/test fixtures, passing unit and browser suites, tenant-isolation evidence, balanced-posting and lock tests, backup restoration proof, security review, performance acceptance, and signed professional validation of regulated accounting configurations.
