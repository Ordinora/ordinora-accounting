param([string]$TestDatabaseUrl = $env:E2E_DATABASE_URL)

$ErrorActionPreference = "Stop"
if (-not $TestDatabaseUrl) { throw "Set E2E_DATABASE_URL to a dedicated PostgreSQL database ending in _e2e." }
$uri = [Uri]$TestDatabaseUrl
$databaseName = $uri.AbsolutePath.Trim("/")
if ($uri.Scheme -notin @("postgres", "postgresql") -or $databaseName -notmatch "^[A-Za-z0-9_]+_e2e$") { throw "Refusing reset: the database name must end in _e2e." }

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path -LiteralPath $psql)) { throw "PostgreSQL psql was not found at $psql." }
$authority = if ($uri.IsDefaultPort) { $uri.Host } else { "$($uri.Host):$($uri.Port)" }
$adminUrl = "$($uri.Scheme)://$($uri.UserInfo)@$authority/postgres"
$quotedDatabase = '"' + $databaseName.Replace('"', '""') + '"'

& $psql $adminUrl -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseName' AND pid <> pg_backend_pid();"
& $psql $adminUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $quotedDatabase;"
& $psql $adminUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $quotedDatabase;"

$env:DATABASE_URL = $TestDatabaseUrl
$env:DIRECT_URL = $TestDatabaseUrl
$env:PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = "1"
$env:PRISMA_SCHEMA_ENGINE_BINARY = (Resolve-Path -LiteralPath "$PSScriptRoot\..\node_modules\@prisma\engines\schema-engine-windows.exe").Path
& "$PSScriptRoot\..\node_modules\.bin\prisma.cmd" migrate deploy
if ($LASTEXITCODE -ne 0) { throw "Prisma migration failed." }
npm.cmd run db:seed
if ($LASTEXITCODE -ne 0) { throw "E2E seed failed." }
Write-Host "Disposable E2E database is ready: $databaseName"
