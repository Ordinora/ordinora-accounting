# Ordinora Accounting — developer and AI handover

Last reviewed: 8 September 2026

Repository: `https://github.com/Ordinora/ordinora-accounting`

Production-facing URL: `https://books.ordinorabs.com`

Default branch: `main`

This document is the starting point for a developer, Codex task, or another coding assistant working on Ordinora Accounting. It records the application shape, non-negotiable controls, development workflow, and deployment process. It deliberately contains no passwords, API keys, health tokens, client records, or private document contents.

## 1. Sources of truth

Use these sources in this order:

1. The checked-out code and `prisma/schema.prisma` define current behaviour and data structures.
2. `prisma/migrations/` defines the database change history. Never edit an already-deployed migration.
3. This handover describes how the parts fit together and how to change them safely.
4. The focused files in `docs/` describe accounting, security, backup, testing, and deployment controls.
5. Git commits record development history and explain when a behaviour changed.
6. Chat history can provide context, but it is not a permanent or authoritative engineering record.

When documentation and running code disagree, verify the deployed commit and configuration, correct the documentation, and do not guess.

## 2. Current system snapshot

The application is a multi-company accounting system for a Brunei accounting firm. It has separate staff and client-portal surfaces and isolates all accounting data by firm and company (called a `Tenant` in code).

The current stack is:

- Next.js 16.3.1 App Router with React 19 and TypeScript.
- Server Components and Server Actions for most application reads and mutations.
- Prisma 6.16.3 with PostgreSQL.
- PostgreSQL 18 in the VPS Compose deployment.
- Docker multi-stage standalone application image running as a non-root user.
- Caddy 2 as the HTTPS reverse proxy.
- ClamAV as the document malware scanner.
- Private local document storage on the current VPS pilot, bind-mounted from `/srv/ordinora/documents`.
- Vitest for unit/integration tests and Playwright for browser acceptance tests.

At this review point, `main` and `origin/main` were at commit `0097e0d` (`Fix dashboard financial period display`). This is a historical reference, not a permanent release pointer; always run `git rev-parse --short HEAD` on the workstation and VPS before maintenance.

There is currently no `.github/workflows` CI configuration and no Git release-tag convention. Verification and deployment are therefore operator-run and must be recorded carefully.

## 3. Product areas

The repository contains working foundations and workflows for:

- Company setup, company-specific financial year end, accounting periods, opening balances, and month/year-end controls.
- Chart of accounts, journals, audit events, period locks, reversals, and financial reports.
- Sales invoices, quotations, orders, credit notes, customer receipts, and settlements.
- Supplier bills, procurement documents, credit notes, payments, and cheque workflows.
- Banking, statement import, transfers, and reconciliations.
- Inventory items, locations, movements, weighted-average/FIFO structures, counts, adjustments, and consumption.
- Fixed assets, depreciation, reconciliation, and disposal.
- Payroll, employee records, SPK configuration, pay runs, opening payroll, final pay, and payroll settlements.
- Tax-year working papers, compliance dates, and capital allowances.
- Client portal, published/live report permissions, questions, notifications, and controlled document uploads.
- Optional AI document-processing providers. AI extraction is not required for ordinary document upload and manual accounting entry.

Regulated accounting, payroll, SPK, tax, and filing assumptions still require review and sign-off by a suitably qualified Brunei professional before being relied on for statutory work. See `implementation-plan.md` and `accounting-validation.md` for the remaining release gates.

## 4. Repository map

| Path | Purpose |
| --- | --- |
| `src/app/` | App Router pages, layouts, route handlers, and feature-local Server Actions. |
| `src/components/` | Shared forms and user-interface components. |
| `src/lib/` | Accounting rules, security/session logic, reports, integrations, and domain services. |
| `src/lib/document-ai/` | Mock, Azure Document Intelligence, and OpenAI document-processing adapters. |
| `prisma/schema.prisma` | Executable relational data model. |
| `prisma/migrations/` | Append-only database migration history. |
| `prisma/seed.ts` | Fictional development seed data. |
| `tests/` | Playwright browser and accounting-cycle acceptance tests. |
| `scripts/` | Production configuration checks, database bootstrap, backup/restore, performance, and E2E helpers. |
| `deploy/` | Reverse-proxy/deployment support files. |
| `docker-compose.oracle-staging.yml` | Current VPS stack definition; the historical filename is intentionally retained. |
| `Dockerfile` | Node 20 multi-stage standalone production image. |
| `.env*.example` | Configuration variable names and safe placeholders only. |
| `docs/` | Requirements, accounting rules, security, tests, backups, and operations runbooks. |
| `AGENTS.md` | Mandatory repository instructions for coding agents. |

Generated directories such as `.next*`, `playwright-report`, `test-results`, `storage`, `output`, `outputs`, and `tmp` are not source code and must not be committed.

## 5. Data ownership and access model

The primary ownership chain is:

`Firm → Tenant (company) → accounting periods and company-owned records`

Important rules:

- `User.kind` separates staff from client users.
- Staff access is role-based and, except for authorised firm/system administrators, company access requires `StaffTenantAssignment`.
- A client user belongs to one company and must never select another tenant through a URL or form value.
- Repository and service functions must derive the actor from the server-side session and apply a tenant condition to every company-owned read or write.
- IDs from forms, URLs, or query strings never grant access by themselves.
- Payroll permissions remain separate from general financial visibility.
- Dormant companies remain available for history but cannot receive ordinary new accounting changes.
- Sensitive reads, posting, approvals, publication, configuration changes, authentication, and document activity are audited.

Before changing authorization, read `security-model.md`, `client-portal.md`, `src/lib/session.ts`, `src/lib/staff-access.ts`, and the relevant action/service files.

## 6. Accounting invariants

Do not weaken these controls:

- Journals must balance, contain at least two lines, and use positive debit-or-credit lines.
- Calculations use integer minor units where practical; Prisma money columns retain `Decimal(19,4)` precision.
- Posting validates the actor, tenant, period, workflow state, and debit/credit equality in one controlled transaction.
- Posted journals are immutable. Corrections use reversals, credit notes, or new adjustments.
- Locked and finalised periods reject ordinary postings.
- Client live figures use posted entries only.
- Published reports are immutable snapshots; later changes require a new version and supersession link.
- Source-document conversions preserve source references and prevent duplicate posting.
- Application code must not silently create accounting entries from an uploaded document or an AI suggestion.

For detailed rules and acceptance evidence, read `accounting-rules.md` and `accounting-validation.md`.

### Company financial years

Each company stores `financialYearEndMonth` and `financialYearEndDay`. The dashboard and normal date filters default from the day after the preceding financial year end through today. Users may override that range.

For example, a company with a 31 October year end defaults to 1 November through today, and the dashboard financial-period badge shows the applicable October year end. Shared logic lives in `src/lib/financial-year.ts` and `src/lib/dashboard-date-range.ts`. New company creation must always capture and validate both year-end fields.

Do not replace this with a global January-to-December assumption.

## 7. Client documents and AI processing

Document upload has two independent gates:

1. Deployment gate: `DOCUMENT_UPLOADS_ENABLED=true`.
2. Company gate: `Tenant.documentUploadEnabled=true` in Client Portal settings.

The current VPS pilot uses:

- `DOCUMENT_STORAGE_PROVIDER=local`
- `DOCUMENT_STORAGE_ROOT=/var/lib/ordinora/documents` inside the app container
- `/srv/ordinora/documents` on the VPS host
- `DOCUMENT_MALWARE_SCAN_MODE=clamav`
- ClamAV service name `clamav`, port `3310`
- A default maximum upload size of 10 MiB unless `UPLOAD_MAX_BYTES` is changed
- Allowlisted PDF, JPG, and PNG validation

Files enter quarantine first. Only clean files are released. A scanner error leaves the file quarantined; it must never be treated as clean. The application and database store metadata, while the private file bytes live in the document store. Both PostgreSQL and `/srv/ordinora/documents` must be backed up together.

AI processing is optional. The provider may be `mock`, Azure Document Intelligence, or OpenAI depending on configuration. Do not add a paid provider key until the business explicitly approves the cost and data-handling terms. AI output is a suggestion requiring review; it must not post transactions automatically.

## 8. Configuration and secrets

Start from `.env.example` for local development and `.env.oracle-staging.example` for the VPS shape. Populate real values only in ignored environment files or an approved secret manager.

Key configuration groups are:

- Database: `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_APP_PASSWORD`.
- Application/session: `APP_URL`, `INSTANCE_ID`, `SESSION_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
- MFA: `MFA_ENCRYPTION_KEY` and temporary `MFA_ENCRYPTION_KEY_PREVIOUS` during rotation.
- Health: `HEALTH_CHECK_TOKEN`.
- Email: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`.
- Uploads: `DOCUMENT_UPLOADS_ENABLED`, `UPLOAD_MAX_BYTES`, storage and scanner settings.
- Optional AI: `DOCUMENT_AI_PROVIDER`, Azure/OpenAI endpoint, model, key, and timeout settings.

Never commit:

- `.env` or any populated environment file.
- Passwords, session secrets, MFA keys, health tokens, API keys, SAS tokens, or database URLs containing credentials.
- Real client documents, exports, screenshots containing personal data, database dumps, or backup archives.
- Production logs that may include private metadata.

Run `npm run config:check` against the intended production configuration before building or restarting production. Startup deliberately fails closed for unsafe upload/storage/scanner settings.

## 9. Local development

Prerequisites: Node.js 20+, npm, Docker Desktop, and Git.

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

Use only fictional data locally unless a formally approved, protected development-data process is established.

Useful commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:cycle
```

The write-enabled E2E cycle destroys and recreates only a database whose name ends in `_e2e`. Never point it at staging or production.

## 10. Database changes

For a schema change:

1. Inspect existing models, constraints, indexes, and service assumptions.
2. Update `prisma/schema.prisma`.
3. Create a new migration locally with `npm run db:migrate` and a meaningful migration name.
4. Review the generated SQL, especially destructive statements, backfills, uniqueness changes, and locks.
5. Run `npm run db:generate`, focused tests, and the full verification gate.
6. Commit the schema and new migration together.
7. Back up production before deploying.
8. In VPS/staging/production, run `npm run db:migrate:deploy` once through the controlled migration container/task.

Never run `prisma migrate dev` against the VPS database. Never manually mark a failed migration as applied without understanding and recording the database state.

## 11. Safe change workflow for Codex or another coding tool

Give the coding tool the repository folder, not only copied code snippets. Then require this workflow:

1. Read `AGENTS.md` completely.
2. Read this handover and the focused documents related to the change.
3. Check `git status --short --branch` and preserve unrelated user changes.
4. For Next.js work, read the relevant installed guide under `node_modules/next/dist/docs/` before editing; this repository uses Next.js 16 and older conventions may be wrong.
5. Trace the full path: page/component → Server Action → domain service → Prisma → audit/report side effects.
6. State assumptions when business behaviour is unclear, particularly accounting, payroll, tax, permissions, and deletion/retention.
7. Make the smallest coherent change and add or update tests.
8. Run focused tests first, then lint, typecheck, unit tests, and a production build in proportion to risk.
9. For posting, permissions, migrations, documents, or reports, also run the relevant Playwright/database acceptance tests.
10. Review the diff for secrets, generated files, accidental data, and unrelated changes.
11. Update this handover or the focused runbook when architecture or operations change.
12. Commit and push only after review; deploy only with an explicit deployment request and a verified backup.

### Reusable prompt for a future coding assistant

```text
Work in the Ordinora Accounting repository. Read AGENTS.md and
docs/developer-handover.md completely before editing. Inspect the current git
status and preserve unrelated changes. Read the relevant installed Next.js 16
documentation before changing Next.js code. Treat prisma/schema.prisma and
prisma/migrations as the database sources of truth. Preserve tenant isolation,
role checks, audit events, balanced posting, period locks, posted-record
immutability, published-report snapshot integrity, and document quarantine.
Never expose or commit secrets or client data. Implement the requested change,
add focused tests, run appropriate verification, and summarize changed files,
tests, migration/deployment impact, and any remaining risk. Do not push or
deploy unless I explicitly request it.

Requested change: <describe the change and acceptance criteria here>
```

## 12. Git and development history

The durable development history is Git, not a conversation transcript.

Before starting:

```powershell
git status --short --branch
git log --oneline --decorate -20
git fetch origin
git rev-parse --short HEAD
git rev-parse --short origin/main
```

Recent milestones visible in Git at the time of this handover include company-specific financial-year date ranges, document workflow and ClamAV upload handling, VPS configuration alignment, PostgreSQL-volume preservation, and the dashboard financial-period display fix.

Use small descriptive commits. For risky changes, use a review branch beginning with `codex/` and merge after verification. Do not force-push `main`. Because the repository currently has no automated GitHub Actions, a successful push alone does not prove the build or tests passed.

## 13. VPS deployment

The checked-out application lives at `/opt/ordinora/app`. The active Compose file is `docker-compose.oracle-staging.yml`; its historical name does not mean it can be casually renamed. Current services are application, PostgreSQL 18, ClamAV, and Caddy.

The live-looking deployment presently uses the explicitly permitted staging/local-storage exception. A future fully reviewed production profile should move documents to approved durable private object storage, connect a secret manager, centralise logs/alerts, and establish encrypted off-host backup retention.

### Before deployment

1. Confirm the requested commit is on GitHub and record its hash.
2. Confirm the VPS working tree has no unexplained changes.
3. Confirm free memory and disk capacity.
4. Create and verify both a PostgreSQL backup and document archive under `/srv/ordinora/backups` or an approved off-host destination.
5. Confirm `/srv/ordinora/documents` exists and the database still uses the Compose-managed `app_ordinora_postgres` volume.
6. Compare the rendered Compose configuration before applying it.

### Release outline

Run from `/opt/ordinora/app` on the VPS. Substitute the reviewed release hash where appropriate.

```sh
sudo -u ordinoraadmin git status --short --branch
sudo -u ordinoraadmin git pull --ff-only origin main
sudo -u ordinoraadmin git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.oracle-staging.yml config --quiet
docker build --pull -t ordinora:production .
docker build --target builder -t ordinora-migrator:production .
```

If the release contains a new Prisma migration, apply it once using the controlled migration procedure in `staging-deployment.md`. Then recreate the application and wait for health:

```sh
docker compose --env-file .env -f docker-compose.oracle-staging.yml up -d --force-recreate app
docker compose --env-file .env -f docker-compose.oracle-staging.yml up -d --wait --wait-timeout 180 app proxy
docker compose --env-file .env -f docker-compose.oracle-staging.yml ps
curl -fsS https://books.ordinorabs.com/api/health/live
```

Call `/api/health/ready` from the VPS with the protected health token obtained from the running app environment. Do not paste the token into documentation, chat, screenshots, or shell history unnecessarily.

After deployment, verify staff login, client access boundaries, the changed workflow, and logs. A Docker warning that Git is not installed inside the build image affects build metadata only; it is not by itself a failed build. Unhealthy services, failed migrations, non-200 health checks, or functional errors are deployment failures.

## 14. Backup and rollback

An application backup is incomplete unless it contains both:

- PostgreSQL data from the actual Compose-managed production volume/database.
- Private documents from `/srv/ordinora/documents`.

Keep backups outside the Git repository and do not push them to GitHub. Verify backup size/checksum and periodically rehearse restoration into an isolated database and empty document directory.

Application rollback means deploying the prior known-good immutable image/commit. Prisma migrations are not automatically reversed. If a database rollback is required, stop writes, assess compatibility, restore the verified pre-release backup, and document the recovery point and validation evidence. See `backup-and-restore.md` and `staging-deployment.md`.

## 15. Health, monitoring, and incident checks

- `/api/health/live` checks process liveness and is public.
- `/api/health/ready` checks configuration, database, and document storage and requires the health token in production.
- Server failures and readiness events use structured JSON logs with redaction.
- Review `docker compose ... ps` and targeted service logs after every release.
- Alerting should cover readiness failures, authentication abuse, quarantined/scanner failures, database/storage capacity, backup failures, and elevated application errors.

External log collection, production alert routing, and a documented on-call process remain important operational work.

## 16. Known follow-up work

Treat this as a review list, not an automatic instruction to implement everything:

- Establish CI for lint, typecheck, unit tests, migration validation, and production build.
- Introduce immutable release tags or image tags linked to Git commits.
- Schedule encrypted off-host database and document backups and record restore rehearsals.
- Centralise logs, alerts, and incident ownership.
- Review migration from the staging local-storage exception to private object storage before declaring a fully reviewed production posture.
- Complete production MFA key-management and recovery procedures.
- Run production-like proxy/load acceptance against anonymised data.
- Obtain professional accounting/payroll/SPK/tax/financial-statement sign-off.
- Keep paid AI providers disabled until business volume, cost, privacy, and accuracy justify activation.

## 17. Related documents

- `accounting-rules.md` — ledger and reporting invariants.
- `accounting-validation.md` — accounting and performance acceptance evidence.
- `security-model.md` — tenant boundaries, authentication, files, and audit.
- `client-portal.md` — client permissions and report visibility.
- `data-model.md` — concise ownership and workflow overview.
- `end-to-end-testing.md` — browser and full accounting-cycle tests.
- `backup-and-restore.md` — backup package and guarded restoration.
- `operations-and-monitoring.md` — health, logging, alerts, and key rotation.
- `staging-deployment.md` — detailed VPS/container release and rollback procedure.
- `implementation-plan.md` — delivered milestones and outstanding release gates.

Update this handover whenever the stack, hosting, deployment paths, storage provider, release process, core accounting rules, or security boundaries change.
