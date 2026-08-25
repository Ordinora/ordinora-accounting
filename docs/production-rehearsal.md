# Production rehearsal

## Verified on 23 August 2026

- Applied all 36 migrations to the dedicated `ordinora_e2e` PostgreSQL database.
- Produced an optimized Next.js 16.3.1 build in `.next-production`.
- Started the compiled application with `next start` on isolated port 3200.
- Passed 10 production-browser checks covering public redirects, staff/client authentication separation, dashboard, chart of accounts, journals, reports, month-end, fixed assets, and depreciation.
- Stopped the temporary production server after verification. The working `ordinora` database and development server on port 3000 were not used.

## Deployment shape

Ordinora requires a Node.js server deployment because authenticated pages, Server Actions, file handlers, and PostgreSQL access are dynamic. Place a production reverse proxy or managed load balancer in front of Next.js for TLS, request limits, rate limiting, and slow-request protection. Apply migrations as a controlled release step before starting the new application version.

## Required production configuration

- A dedicated PostgreSQL database and restricted database role.
- Strong `SESSION_SECRET`, HTTPS `APP_URL`, and production-only service credentials.
- A stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` when more than one application instance is used.
- Private Azure Blob document storage; local `./storage` is development-only.
- Central logs, error monitoring, health checks, alerting, and graceful shutdown time.
- Automated encrypted backups plus a successfully rehearsed restoration.

## Security hardening completed after rehearsal

- Added one database-backed login-throttling policy to staff and client-portal authentication.
- Confirmed five-failure identity lockout, broader source throttling, generic non-enumerating errors, successful-login reset, and audit metadata behavior.
- Extended the disposable E2E suite to nine tests, including both authentication surfaces; all nine pass alongside accounting-cycle, concurrency, and tenant-isolation coverage.
- Added thirty-minute idle-session expiry and a firm-scoped administrator session console; the expanded eleven-test browser suite verifies both automatic idle rejection and forced client-session revocation.
- Added authenticator MFA for staff and client accounts with encrypted secrets, five-minute challenges, five-attempt limits, and hashed one-time recovery codes; the expanded twelve-test browser suite verifies enrollment and mandatory second-step sign-in.
- Added a tenant-scoped quarantine-to-release document pipeline. Structural checks, active-PDF rejection, audit records, protected downloads, and a focused clean-versus-quarantined browser test now pass; production still requires a deployed ClamAV service or equivalent scanner.
- Created a PostgreSQL-plus-private-documents backup package, verified every dump/file checksum, and successfully restored it into `ordinora_restore_test`. All 36 completed migrations, nine document files, and core company/user/journal/document counts matched the backup manifest.
- Reviewed Server Action CSRF behavior against the installed Next.js 16 guidance. The application retains the default same-origin Origin/Host validation and does not widen `allowedOrigins`.
- Added an unauthenticated liveness endpoint, token-protected readiness endpoint, redacted JSON server-error events, and strict production configuration validation. The disposable browser suite verifies PostgreSQL and private-storage readiness.
- Added local reverse-proxy contract acceptance for forwarded headers, protected-route redirects, token-protected readiness, and Next.js Server Action Host/Origin enforcement. A forged external origin was rejected before login execution. A 20-user, 200-request public HTTP run completed with zero failures at 27.4 requests/second and 1,186.5 ms p95 against a 1,500 ms limit. This does not replace testing through the deployed TLS proxy or load balancer.
- The current disposable development-browser regression suite contains 14 passing tests.

## Remaining release blockers

The successful build is not authorization to use real client data. MFA production key/recovery acceptance testing, production proxy CSRF acceptance testing, production malware-scanner deployment, private object storage, scheduled backup restoration, secrets/key management, external monitoring/alert routing, and Brunei-qualified accounting/payroll/tax validation remain release gates.
