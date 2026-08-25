# Ordinora Accounting

Production-oriented, multi-client accounting software for a Brunei accounting firm. The current build includes the internal accounting, multicurrency and inventory foundations, plus the first **Payroll/SPK foundation**. It is not yet suitable for real financial data.

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

Implemented: staff dashboard UI, tenant/staff/client role model, chart-of-accounts and journal schema, immutable audit schema, period locks, report publication/version model, document/question foundations, exact minor-unit accounting helpers, balanced-entry validation, locked-period checks, posted-entry immutability rules, and tenant-access guards.

Current payroll scope: tenant-isolated employee records, configurable effective-dated SPK bands, restricted pay-run preparation, employee-level gross/net calculations, approval, and balanced payroll-journal posting with period-lock enforcement. Payslips, final-pay processing, payroll-run locking and payment settlement remain planned. Portal access defaults to published-only and payroll access defaults off.

## Important limitations

This is development software, not a legal filing or production accounting system. Demonstration SPK and tax parameters must be verified by a Brunei-qualified accountant before use. MFA is implemented but still requires production key management and acceptance testing; object storage, malware scanning, email delivery, production backups, and operational monitoring remain deployment work.

See `docs/` for the requirements, accounting rules, data model, security model, client portal policy, and implementation plan.
