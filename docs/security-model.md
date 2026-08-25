# Security model

## Trust boundaries

The browser is untrusted. Every read, mutation, download, and export derives the actor from a server-side session and applies role, tenant, assignment, object ownership and state checks. Tenant identifiers supplied by forms, URLs or query parameters never grant access.

## Authorization

- System/Firm Administrators may access all firm tenants; other staff require an active `StaffTenantAssignment`.
- Client users have one immutable `tenantId` and can access only explicitly permitted portal resources for that tenant.
- Financial visibility never implies payroll visibility. Payroll grants are separate capabilities.
- Repository functions require an `AccessContext`; tenant filters are mandatory and compound unique keys include tenant where appropriate.
- Random UUID/CUID identifiers reduce enumeration but never replace authorization.

## Authentication baseline

Password hashes use bcrypt, and sessions use random opaque tokens stored hashed server-side with a thirty-minute inactivity limit and eight-hour absolute expiry. Activity writes are limited to once per five minutes. Cookies are HTTP-only, SameSite=Lax, and Secure in production. Disabled users, administratively revoked sessions, idle sessions, and absolutely expired sessions are rejected. Firm/System Administrators can view and revoke only sessions belonging to users in their own firm; every administrative revocation requires a reason and creates an audit event.

Application responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict cross-origin referrer policy, and a restrictive camera/microphone/geolocation permissions policy. The production TLS endpoint should additionally set and rehearse HSTS only after the final HTTPS hostname and certificate lifecycle are established.

Staff and client-portal authentication share a database-backed fifteen-minute throttle: five failures for an email identity or twenty-five failures from one request source. Email and source identifiers are stored only as scope-separated SHA-256 digests, successful authentication clears prior failures for that identity, and responses do not reveal whether an account exists or is disabled. The application relies on Next.js Server Action same-origin checks for CSRF protection; production reverse-proxy Host/Origin forwarding must be acceptance-tested and `allowedOrigins` must remain unset unless a reviewed proxy topology requires it.

Optional authenticator MFA is available to staff and client users. Secrets are encrypted at rest with AES-256-GCM, a five-minute one-time challenge is required after the password, challenges are limited to five attempts, and eight hashed single-use recovery codes are issued at enrollment. Production must set a separate strong `MFA_ENCRYPTION_KEY`, protect and rotate that key through deployment key management, and complete authenticator/recovery acceptance testing. Deployment-level edge rate limits remain required before production client access.

## Files and exports

Uploads are size-limited and require an allowlisted extension, MIME type, opening signature, and valid ending marker. Every accepted upload is first written with a random name into a tenant-scoped quarantine directory. The scanner rejects malware-test signatures and active or embedded PDF content; clean files are atomically released to a separate private directory. Quarantined and scan-pending files cannot be downloaded or processed. Authenticated download handlers enforce tenant/object ownership, `nosniff`, sandboxing, and private no-store caching. Development can use `DOCUMENT_MALWARE_SCAN_MODE=basic`; production must use `clamav` or an equivalent reviewed scanner and durable private object storage.

## Audit

Append-only records cover successful and failed authentication, reads of sensitive reports, downloads, uploads, approvals, posting, reversal, publication, and configuration changes. Application roles have no update/delete permission over audit rows in production.
