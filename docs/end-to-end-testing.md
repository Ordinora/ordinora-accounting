# End-to-end accounting checks

The Playwright smoke suite is read-only for accounting records. It verifies public access boundaries and, when credentials are supplied, opens critical staff accounting pages and checks for runtime failures.

## Run against the local application

```powershell
$env:E2E_STAFF_EMAIL="accountant@demo.invalid"
$env:E2E_STAFF_PASSWORD="DemoOnly-ChangeMe!"
npm.cmd run test:e2e
```

Without the two credential variables, the authentication-boundary tests run and authenticated tests are skipped. A successful login creates normal session, login-attempt, and audit metadata but does not post or edit accounting transactions.

Use a dedicated test database in CI. Never seed or reset a database containing client data.

## Run the write-enabled accounting cycle

Copy the connection pattern from `.env.e2e.example`, supply the test password, and run:

```powershell
$env:E2E_DATABASE_URL="postgresql://postgres:password@localhost:5432/ordinora_e2e?schema=public"
npm.cmd run test:e2e:cycle
```

The runner refuses database names that do not end in `_e2e`. It recreates that database, applies every migration, seeds fictional records, and tests sales invoice → receipt and supplier bill → payment before checking the Income Statement and Trial Balance.
