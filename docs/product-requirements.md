# Product requirements

## Purpose

Ordinora gives an accounting firm one controlled workspace for 50–100 Brunei client entities. Staff prepare, review, approve, post, and report. Client users later receive a separate, narrow portal containing only expressly authorized and approved information.

## Delivery sequence

1. **Internal accounting foundation:** authentication, tenancy, assignments, clients, accounts, journals, sales/purchases, cash allocations, reports, locks, audit.
2. **Client portal foundation:** client roles, published reports, secure downloads, uploads, questions, portal audit.
3. **Live posted reporting:** disclaimers, timestamps, configurable cards, controlled drill-down and caching.
4. Inventory and weighted-average costing.
5. Payroll, configurable SPK, locking and granular disclosure.
6. Tax working papers, capital allowances, reminders and retention.

## Non-negotiable acceptance criteria

Each milestone must run locally, migrate and seed, pass lint/type/unit/browser checks, prove tenant isolation and accounting invariants, and document limitations. No client sees drafts, internal notes, unposted data, another tenant, or payroll details without an explicit payroll grant.

## Assumptions

- BND is the default currency and amounts use integer minor units in the posting engine.
- One firm instance is initially supported; firm ownership remains explicit in the model.
- Client users belong to exactly one tenant.
- New client portals are disabled and `PUBLISHED_ONLY` until enabled by firm administration.
- Four-eyes approval is configurable; creator, reviewer, approver and poster remain separately attributable.
- No general GST/VAT is assumed; a configurable zero-rate tax code is seeded.
