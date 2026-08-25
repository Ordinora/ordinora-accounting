# Operations and monitoring

## Health endpoints

- `GET /api/health/live` is a public process-liveness check. It does not access PostgreSQL, storage, sessions, or secrets.
- `GET /api/health/ready` verifies production configuration, PostgreSQL connectivity, and read/write access to private document storage. In production it requires `Authorization: Bearer <HEALTH_CHECK_TOKEN>` or `X-Health-Token`.
- Both endpoints send `Cache-Control: no-store`. The readiness response exposes only boolean component status and a request ID; it does not expose paths, database URLs, credentials, or exception details.

Configure a load balancer to use `/api/health/live` for process replacement and `/api/health/ready` for traffic admission. Do not attach the readiness token to a public browser or client-side bundle.

## Required production settings

Startup fails closed when any of these requirements are unsafe:

- PostgreSQL `DATABASE_URL`.
- Unique strong `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, and `HEALTH_CHECK_TOKEN` values.
- Stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` that decodes to exactly 32 bytes.
- HTTPS `APP_URL`.
- `DOCUMENT_MALWARE_SCAN_MODE=clamav`.
- `DOCUMENT_STORAGE_PROVIDER=azure`, a private HTTPS `AZURE_BLOB_CONTAINER_URL`, and a narrowly scoped `AZURE_BLOB_SAS_TOKEN`.

Generate every key using a cryptographically secure secret manager. Never reuse keys between purposes or commit their values.

## Structured server logs

Server lifecycle, request failures, and readiness failures are emitted as one-line JSON events. Sensitive keys and PostgreSQL credentials are redacted. Forward stdout and stderr to a central collector and retain access to logs only for authorized operators.

Recommended alerts:

- Readiness remains unsuccessful for two consecutive checks.
- Repeated `request.failed` events for the same route or a material error-rate increase.
- Authentication throttling or MFA recovery events exceed the expected baseline.
- Quarantined uploads, scanner failures, backup verification failures, or restore-rehearsal failures occur.
- PostgreSQL capacity, storage capacity, response latency, or process memory crosses the approved deployment threshold.

Alert notifications must link to request IDs and operational runbooks, not include client documents, credentials, or database URLs.

## Acceptance checklist

Before production traffic, verify the endpoints through the actual TLS proxy, confirm the readiness token is not publicly exposed, trigger and acknowledge a synthetic alert, confirm log redaction with test values, and record the responsible on-call contact and escalation route.

## Key rotation

Store deployment values in the hosting platform's secret manager, not `.env` files on production servers. Rotate the health token and storage SAS credential by updating the secret manager and restarting instances in a controlled order. A storage SAS credential should be container-scoped, HTTPS-only, short-lived, and limited to the operations Ordinora requires.

For MFA encryption-key rotation, set the new value as `MFA_ENCRYPTION_KEY` and temporarily retain the old value as `MFA_ENCRYPTION_KEY_PREVIOUS`. New enrollments use the new key, while existing secrets remain readable with the previous key. Complete a controlled re-enrollment or re-encryption campaign before removing the previous key. Never replace both values simultaneously without first recovering every enrolled user.
