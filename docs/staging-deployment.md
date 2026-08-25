# Staging deployment runbook

Staging must use fictional or anonymised data. It is a production-shaped acceptance environment, not authorization to process live client records.

## Required services

1. A Node.js 20 container service behind an HTTPS load balancer or reverse proxy.
2. A dedicated PostgreSQL database and restricted application role. Do not share the development database.
3. A private Azure Blob container dedicated to staging.
4. A reachable ClamAV service (or an equivalently reviewed malware-scanning adapter).
5. A secret manager, central JSON log collection, alert routing, and encrypted off-host backups.

## Oracle Cloud Always Free pilot profile

For the fictional-data staging pilot, use one Always Free-eligible Ampere A1 VM in the tenancy home region with 2 OCPUs and 12 GB memory when capacity is available. Oracle currently documents 1,500 A1 OCPU-hours and 9,000 GB-hours monthly, equivalent to that allocation, plus 200 GB total Always Free block volume and limited Object Storage. Always confirm that every resource is labelled **Always Free eligible** before creating it; resources outside the home region or limits may be billed, and idle instances can be reclaimed.

Use Ubuntu 24.04 or Oracle Linux, attach a durable block volume, and mount it for Docker volumes. Open inbound TCP 22 only from the administrator's IP and TCP 80/443 publicly. Do not expose PostgreSQL port 5432, ClamAV port 3310, or application port 3000 through the OCI network security group.

The supplied `docker-compose.oracle-staging.yml` runs Caddy, Ordinora, PostgreSQL, and an isolated ClamAV daemon. It deliberately allows private local block storage only when both `DEPLOYMENT_ENV=staging` and `ALLOW_STAGING_LOCAL_STORAGE=true`. This exception is for anonymised pilot data; the production profile still requires reviewed private object storage and off-host backup.

### VM deployment sequence

1. Point a staging DNS record such as `accounts-staging.example.com` to the VM public IP. Do not reuse the main website hostname.
2. Install Docker Engine with the Compose plugin and enable its service.
3. Copy the repository to `/opt/ordinora`, copy `.env.oracle-staging.example` to `.env.oracle-staging`, and replace every placeholder. Restrict the file to the deployment administrator.
4. Generate secrets independently. The Server Actions key is `openssl rand -base64 32`; the other secrets can be generated with `openssl rand -hex 32`.
5. Build the immutable image: `docker build -t ordinora:staging .`.
6. Validate the rendered stack: `docker compose --env-file .env.oracle-staging -f docker-compose.oracle-staging.yml config --quiet`.
7. Start only the database and scanner: `docker compose --env-file .env.oracle-staging -f docker-compose.oracle-staging.yml up -d db clamav`, and wait for both health checks.
8. Apply migrations once: `docker compose --env-file .env.oracle-staging -f docker-compose.oracle-staging.yml run --rm app npx prisma migrate deploy`.
9. Start the application and proxy: `docker compose --env-file .env.oracle-staging -f docker-compose.oracle-staging.yml up -d app proxy`.
10. Verify `https://<staging-domain>/api/health/live`, then call the protected readiness endpoint with `X-Health-Token` from the VM.
11. Load fictional acceptance data only, run the browser suite through the HTTPS hostname, and record the release image tag, migration list, health evidence, and test results.

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
