param([Parameter(Mandatory=$true)][string]$BackupPath)

$ErrorActionPreference = "Stop"
$resolved = [IO.Path]::GetFullPath($BackupPath)
$manifestPath = Join-Path $resolved "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Backup manifest.json is missing." }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.formatVersion -ne 1) { throw "Unsupported backup format version." }

$dump = Join-Path $resolved $manifest.databaseDump.path
if (-not (Test-Path -LiteralPath $dump -PathType Leaf)) { throw "Database dump is missing." }
if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.databaseDump.sha256) { throw "Database dump checksum mismatch." }

foreach ($document in $manifest.documents) {
  $file = [IO.Path]::GetFullPath((Join-Path $resolved "documents" $document.path))
  $documentRoot = [IO.Path]::GetFullPath((Join-Path $resolved "documents"))
  if (-not $file.StartsWith("$documentRoot$([IO.Path]::DirectorySeparatorChar)")) { throw "Unsafe document path in backup manifest." }
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Backup document is missing: $($document.path)" }
  if ((Get-Item -LiteralPath $file).Length -ne $document.sizeBytes) { throw "Backup document size mismatch: $($document.path)" }
  if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $document.sha256) { throw "Backup document checksum mismatch: $($document.path)" }
}
Write-Output "VERIFIED database=$($manifest.databaseName) documents=$($manifest.documents.Count)"
