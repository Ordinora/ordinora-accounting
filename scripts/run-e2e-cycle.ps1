param([string]$TestDatabaseUrl = $env:E2E_DATABASE_URL)

$ErrorActionPreference = "Stop"
if (-not $TestDatabaseUrl) { throw "Set E2E_DATABASE_URL before running the accounting cycle." }
& "$PSScriptRoot\reset-e2e-db.ps1" -TestDatabaseUrl $TestDatabaseUrl
$env:DATABASE_URL = $TestDatabaseUrl
$env:E2E_DATABASE_URL = $TestDatabaseUrl
$env:E2E_ALLOW_ACCOUNTING_WRITES = "true"
$env:E2E_BASE_URL = "http://localhost:3100"
$env:NEXT_DIST_DIR = ".next-e2e"
$testStorage = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\tmp\e2e-document-storage"))
$expectedStorageParent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\tmp"))
if (-not $testStorage.StartsWith("$expectedStorageParent$([IO.Path]::DirectorySeparatorChar)")) { throw "Unsafe E2E document-storage path." }
if (Test-Path -LiteralPath $testStorage) { Remove-Item -LiteralPath $testStorage -Recurse -Force }
New-Item -ItemType Directory -Path $testStorage -Force | Out-Null
$env:DOCUMENT_STORAGE_ROOT = $testStorage
$env:E2E_STAFF_EMAIL = "accountant@demo.invalid"
$env:E2E_STAFF_PASSWORD = "DemoOnly-ChangeMe!"
npm.cmd exec -- playwright test tests/e2e/accounting-cycle.spec.ts tests/e2e/authentication-throttle.spec.ts tests/e2e/document-quarantine.spec.ts tests/e2e/health.spec.ts tests/e2e/mfa.spec.ts tests/e2e/proxy-http-security.spec.ts tests/e2e/session-controls.spec.ts tests/e2e/tenant-isolation.spec.ts tests/e2e/concurrent-posting.spec.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw "Accounting-cycle browser test failed." }
npm.cmd exec -- playwright test tests/e2e/commercial-documents.spec.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw "Commercial-document browser test failed." }
npm.cmd exec -- playwright test tests/e2e/inventory-month-end.spec.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw "Inventory month-end browser test failed." }
npm.cmd exec -- playwright test tests/e2e/published-report-integrity.spec.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw "Published-report integrity browser test failed." }
