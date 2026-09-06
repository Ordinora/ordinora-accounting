# Staging deployment runbook

Staging must use fictional or anonymised data. It is a production-shaped acceptance environment, not authorization to process live client records.

## Required services

1. A Node.js 20 container service behind an HTTPS load balancer or reverse proxy.
2. A dedicated PostgreSQL database and restricted application role. Do not share the development database.
3. A private Azure Blob container dedicated to staging.
4. A reachable ClamAV service (or an equivalently reviewed malware-scanning adapter).
5. A secret manager, central JSON log collection, alert routing, and encrypted off-host backups.

## Spaceship VPS pilot profile

The current pilot runs on a Spaceship Ubuntu VPS. Spaceship SSH uses TCP 22022; TCP 80/443 are public. PostgreSQL port 5432, ClamAV port 3310, and application port 3000 must not be exposed publicly.

The supplied `docker-compose.oracle-staging.yml` retains its historical filename for deployment compatibility. It runs Caddy, Ordinora, PostgreSQL 18, and an isolated ClamAV daemon. PostgreSQL data uses the Compose-managed `ordinora_postgres` volume (currently materialised as `app_ordinora_postgres`), while private documents are bind-mounted from `/srv/ordinora/documents`. Both stores must be included in backup and restore procedures. Local document storage is allowed only when both `DEPLOYMENT_ENV=staging` and `ALLOW_STAGING_LOCAL_STORAGE=true` are set. This exception is for the pilot; a production review must assess encrypted off-host object storage and backups.

### VM deployment sequence

1. Point a staging DNS record such as `accounts-staging.example.com` to the VM public IP. Do not reuse the main website hostname.
2. Install Docker Engine with the Compose plugin and enable its service.
3. Copy the repository to `/opt/ordinora/app`, copy `.env.oracle-staging.example` to `.env.oracle-staging`, and replace every placeholder. Keep Compose interpolation values in the root `.env`. Restrict both populated files to the deployment administrator and never commit them.
4. Generate secrets independently. The Server Actions key is `openssl rand -base64 32`; the other secrets can be generated with `openssl rand -hex 32`.
5. Create `/srv/ordinora/documents` and `/srv/ordinora/backups` with ownership and permissions appropriate for the application and deployment administrator. Let Compose create and manage the `ordinora_postgres` database volume.
6. Build the immutable application image: `docker build --pull -t ordinora:production .`.
7. Validate the rendered stack: `docker compose --env-file .env -f docker-compose.oracle-staging.yml config --quiet`.
8. Start only the database and scanner: `docker compose --env-file .env -f docker-compose.oracle-staging.yml up -d db clamav`, and wait for both health checks.
9. Build the migration image: `docker build --target builder -t ordinora-migrator:production .`.
10. Apply migrations once through the private Compose network: `docker run --rm --network app_default --env-file .env ordinora-migrator:production sh -c 'export DATABASE_URL="postgresql://ordinora_app:${POSTGRES_APP_PASSWORD}@db:5432/ordinora_staging?schema=public"; export DIRECT_URL="$DATABASE_URL"; npm run db:migrate:deploy'`.
11. Start the application and proxy: `docker compose --env-file .env -f docker-compose.oracle-staging.yml up -d --wait app proxy`.
12. Verify `https://<staging-domain>/api/health/live`, then call the protected readiness endpoint with `X-Health-Token` from the VPS.
13. Load fictional acceptance data only, run the browser suite through the HTTPS hostname, and record the release image tag, migration list, health evidence, and test results.

## Release sequence

1. Copy the variable names from `.env.staging.example` into the platform secret manager and replace every placeholder.
   Do not place a real `.env` file in the container build context: Next.js standalone output can copy build-context environment files into its runtime bundle. The included `.dockerignore` excludes all real `.env*` files.
2. Run `npm ci`, `npm run db:generate`, and `npm run config:check` in the release job.
3. Back up the staging database and document container before upgrading an existing environment.
4. Run `npm run db:migrate:deploy` exactly once as a controlled release task. Do not run `prisma migrate dev` in staging or production.
5. Build the application with `docker build -t ordinora:<release> .` and deploy that immutable image.
6. Configure the public liveness probe as `GET /api/health/live` and the private readiness probe as `GET /api/health/ready` with `X-Health-Token` supplied by the load balancer.
7. Verify Host, Origin, and `X-Forwarded-Proto` preservation through the real HTTPS endpoint before enabling users.

## Acceptance evidence

- `npm run config:check`, migration status, lint, typecheck, unit tests, and browser tests pass against staging.
- Staff and client authentication, MFA enrollment/recovery, tenant isolation, posting, reporting, upload quarantine, and protected downloads pass through the public HTTPS hostname.
- A synthetic alert is received and acknowledged; logs contain request IDs but no credentials, database URLs, or document contents.
- Backup verification and a restore into a separate database/container succeed.
- Concurrent HTTP acceptance passes through the deployed proxy using the agreed traffic and latency targets.
- A Brunei-qualified reviewer signs the accounting, payroll/SPK, tax, and financial-statement configuration before any live client data is permitted.

## Rollback

Application rollback uses the previous immutable container image. Database rollback is not performed by reversing Prisma migrations automatically: stop writes, assess the failed release, and restore the verified pre-release backup when a data rollback is required. Record the decision, recovery point, and validation results.
