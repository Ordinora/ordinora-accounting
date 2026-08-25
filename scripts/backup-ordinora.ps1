param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupRoot = (Join-Path $PSScriptRoot "..\backups"),
  [string]$DocumentStorageRoot = $env:DOCUMENT_STORAGE_ROOT
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\backup-common.ps1"

if (-not $DatabaseUrl) {
  $line = Get-Content (Join-Path $PSScriptRoot "..\.env") | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  $DatabaseUrl = ($line -replace '^DATABASE_URL=', '').Trim().Trim('"')
}
if (-not $DocumentStorageRoot) { $DocumentStorageRoot = Join-Path $PSScriptRoot "..\storage\accounting-documents" }

$connection = ConvertFrom-OrdinoraDatabaseUrl $DatabaseUrl
$resolvedBackupRoot = [IO.Path]::GetFullPath($BackupRoot)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $resolvedBackupRoot "ordinora-$stamp-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$documentsPath = Join-Path $backupPath "documents"
New-Item -ItemType Directory -Path $documentsPath -Force | Out-Null

$dumpPath = Join-Path $backupPath "database.dump"
$temporaryDump = Join-Path ([IO.Path]::GetTempPath()) "ordinora-$([Guid]::NewGuid().ToString('N')).dump"
$pgDump = Get-OrdinoraPostgresTool "pg_dump"
try {
  Invoke-OrdinoraPostgresTool $pgDump @("--host", $connection.Host, "--port", "$($connection.Port)", "--username", $connection.User, "--dbname", $connection.Database, "--format=custom", "--no-owner", "--no-privileges", "--file", $temporaryDump) $connection.Password
  Move-Item -LiteralPath $temporaryDump -Destination $dumpPath
} finally {
  Remove-Item -LiteralPath $temporaryDump -Force -ErrorAction SilentlyContinue
}

$resolvedDocuments = [IO.Path]::GetFullPath($DocumentStorageRoot)
if (Test-Path -LiteralPath $resolvedDocuments) {
  Get-ChildItem -LiteralPath $resolvedDocuments -File -Recurse | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($resolvedDocuments, $_.FullName)
    $destination = Join-Path $documentsPath $relative
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination
  }
}

$documentManifest = @(Get-ChildItem -LiteralPath $documentsPath -File -Recurse | Sort-Object FullName | ForEach-Object {
  [pscustomobject]@{
    path = [IO.Path]::GetRelativePath($documentsPath, $_.FullName).Replace("\", "/")
    sizeBytes = $_.Length
    sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
})
$psql = Get-OrdinoraPostgresTool "psql"
$countsJson = Invoke-OrdinoraPostgresQuery $psql @("--host", $connection.Host, "--port", "$($connection.Port)", "--username", $connection.User, "--dbname", $connection.Database, "--no-psqlrc", "--tuples-only", "--no-align", "--command", 'SELECT json_build_object(''tenants'',(SELECT COUNT(*) FROM "Tenant"),''users'',(SELECT COUNT(*) FROM "User"),''journals'',(SELECT COUNT(*) FROM "Journal"),''documents'',(SELECT COUNT(*) FROM "Document"))::text;') $connection.Password
$databaseCounts = $countsJson | ConvertFrom-Json
$manifest = [ordered]@{
  formatVersion = 1
  createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  databaseName = $connection.Database
  databaseCounts = $databaseCounts
  databaseDump = [ordered]@{ path = "database.dump"; sha256 = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant() }
  documents = $documentManifest
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $backupPath "manifest.json") -Encoding utf8NoBOM
Write-Output $backupPath
