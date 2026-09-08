# Ordinora Accounting

Production-oriented, multi-client accounting software for a Brunei accounting firm. The application includes internal accounting, commercial documents, banking, inventory, fixed assets, payroll/SPK, tax working papers, reporting, notifications, and a controlled client portal.

Start with [`docs/developer-handover.md`](docs/developer-handover.md) before maintaining, extending, or deploying the application. It records the current architecture, security and accounting invariants, configuration, test workflow, VPS release process, backup/rollback controls, and a reusable handover prompt for Codex or another coding assistant.

## Local setup

1. Install Node.js 20+ and Docker Desktop.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL: `docker compose up -d db`.
4. Install dependencies: `npm install`.
5. Generate the database client: `npm run db:generate`.
6. Apply the development migration: `npm run db:migrate`.
7. Seed fictional data: `npm run db:seed`.
8. Start the app: `npm run dev` and open `http://localhost:3000`.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Staging and production-shaped deployment

Use `npm run config:check` to validate fail-closed production settings and `npm run db:migrate:deploy` for controlled non-development migrations. The application can be packaged with the repository `Dockerfile`; see `docs/staging-deployment.md` for the required services, release order, acceptance evidence, and rollback policy.

## Current scope

Implemented areas include tenant/staff/client access, company-specific financial years, chart of accounts, journals, audit, period controls, financial reports, sales and purchases, receipts and payments, banking and reconciliation, inventory, fixed assets, payroll/SPK, tax working papers, notifications, published client reports, questions, and quarantined document upload.

Portal access defaults to off, published-only reporting is the default when enabled, payroll visibility is independently controlled, and document upload requires both a deployment-wide switch and a per-company switch.

## Important limitations

This software must not be treated as professional accounting, payroll, tax, or legal advice. SPK, tax, capital-allowance, filing, and financial-statement behaviour must be verified by a Brunei-qualified professional. The current VPS uses ClamAV and durable local document storage under a staging exception; fully reviewed production object storage, off-host backups, centralized monitoring, and secret management remain operational work.

See `docs/` for the requirements, accounting rules, data model, security model, client portal policy, and implementation plan.
