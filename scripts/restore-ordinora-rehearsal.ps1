param(
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$RestoreDatabaseUrl,
  [Parameter(Mandatory=$true)][string]$RestoreDocumentRoot
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\backup-common.ps1"
& "$PSScriptRoot\verify-ordinora-backup.ps1" -BackupPath $BackupPath

$connection = ConvertFrom-OrdinoraDatabaseUrl $RestoreDatabaseUrl
if ($connection.Database -notmatch '_restore_test$') { throw "Restore is allowed only into a database whose name ends with _restore_test." }

$documentTarget = [IO.Path]::GetFullPath($RestoreDocumentRoot)
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if ($documentTarget -eq $workspace -or $documentTarget.Length -lt ($workspace.Length + 8)) { throw "Choose a dedicated restore-test document directory." }
if (Test-Path -LiteralPath $documentTarget) {
  if ((Get-ChildItem -LiteralPath $documentTarget -Force | Measure-Object).Count -gt 0) { throw "Restore document directory must be empty." }
} else { New-Item -ItemType Directory -Path $documentTarget -Force | Out-Null }

$psql = Get-OrdinoraPostgresTool "psql"
$pgRestore = Get-OrdinoraPostgresTool "pg_restore"
$adminArguments = @("--host", $connection.Host, "--port", "$($connection.Port)", "--username", $connection.User, "--dbname", "postgres", "--no-psqlrc", "--set", "ON_ERROR_STOP=1")
$escapedDatabase = $connection.Database.Replace('"', '""')
Invoke-OrdinoraPostgresTool $psql ($adminArguments + @("--command", "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$($connection.Database.Replace("'", "''"))' AND pid <> pg_backend_pid();")) $connection.Password
Invoke-OrdinoraPostgresTool $psql ($adminArguments + @("--command", "DROP DATABASE IF EXISTS `"$escapedDatabase`";")) $connection.Password
Invoke-OrdinoraPostgresTool $psql ($adminArguments + @("--command", "CREATE DATABASE `"$escapedDatabase`";")) $connection.Password

$dump = Join-Path ([IO.Path]::GetFullPath($BackupPath)) "database.dump"
$temporaryDump = Join-Path ([IO.Path]::GetTempPath()) "ordinora-restore-$([Guid]::NewGuid().ToString('N')).dump"
try {
  Copy-Item -LiteralPath $dump -Destination $temporaryDump
  Invoke-OrdinoraPostgresTool $pgRestore @("--host", $connection.Host, "--port", "$($connection.Port)", "--username", $connection.User, "--dbname", $connection.Database, "--no-owner", "--no-privileges", "--exit-on-error", $temporaryDump) $connection.Password
} finally {
  Remove-Item -LiteralPath $temporaryDump -Force -ErrorAction SilentlyContinue
}

$sourceDocuments = Join-Path ([IO.Path]::GetFullPath($BackupPath)) "documents"
if (Test-Path -LiteralPath $sourceDocuments) { Copy-Item -Path (Join-Path $sourceDocuments "*") -Destination $documentTarget -Recurse -Force }
$migrationCount = Invoke-OrdinoraPostgresQuery $psql @("--host", $connection.Host, "--port", "$($connection.Port)", "--username", $connection.User, "--dbname", $connection.Database, "--no-psqlrc", "--tuples-only", "--no-align", "--command", 'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;') $connection.Password
if ([int]$migrationCount -lt 1) { throw "Restored database migration verification failed." }
$manifest = Get-Content -LiteralPath (Join-Path ([IO.Path]::GetFullPath($BackupPath)) "manifest.json") -Raw | ConvertFrom-Json
if ($manifest.databaseCounts) {
  $countsJson = Invoke-OrdinoraPostgresQuery $psql @("--host", $connection.Host, "--port", "$($connection.Port)", "--username", $connection.User, "--dbname", $connection.Database, "--no-psqlrc", "--tuples-only", "--no-align", "--command", 'SELECT json_build_object(''tenants'',(SELECT COUNT(*) FROM "Tenant"),''users'',(SELECT COUNT(*) FROM "User"),''journals'',(SELECT COUNT(*) FROM "Journal"),''documents'',(SELECT COUNT(*) FROM "Document"))::text;') $connection.Password
  $restoredCounts = $countsJson | ConvertFrom-Json
  foreach ($name in @("tenants", "users", "journals", "documents")) {
    if ([int64]$restoredCounts.$name -ne [int64]$manifest.databaseCounts.$name) { throw "Restored $name count does not match the backup manifest." }
  }
}
Write-Output "RESTORED database=$($connection.Database) migrations=$migrationCount documents=$documentTarget"
