# Data model

The Prisma schema is the executable model. Main ownership chain:

`Firm → Tenant → Period / Account / Journal / Report / Document / Question`

Staff access is many-to-many through assignments. Client access is one-to-one from user to tenant. Every client-owned aggregate carries `tenantId`; child rows whose tenant is implied by a parent are additionally protected through tenant-scoped repository entry points and database foreign keys. Financial references use compound tenant uniqueness.

Journal workflow is `DRAFT → IN_REVIEW → APPROVED → POSTED`, with `REVERSED` as a linked correction outcome. Report versions move through `DRAFT`, `LIVE_POSTED`, `PUBLISHED`, `FINALIZED`, and `SUPERSEDED`; replacement creates a new row and links the prior version.

Inventory, payroll, SPK and tax tables are deliberately deferred beyond the foundation, but module boundaries and tenant ownership are reserved in the product requirements so those domains cannot bypass ledger posting.
