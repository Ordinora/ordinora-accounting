function Get-OrdinoraPostgresTool([string]$Name) {
  $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName "bin\$Name.exe" } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if (-not $candidate) { throw "$Name was not found. Install the PostgreSQL command-line tools." }
  return $candidate
}

function ConvertFrom-OrdinoraDatabaseUrl([string]$DatabaseUrl) {
  if (-not $DatabaseUrl) { throw "A PostgreSQL DATABASE_URL is required." }
  $uri = [Uri]$DatabaseUrl
  if ($uri.Scheme -notin @("postgresql", "postgres")) { throw "Only PostgreSQL database URLs are supported." }
  $parts = $uri.UserInfo.Split(":", 2)
  if ($parts.Count -ne 2) { throw "The database URL must contain a username and password." }
  $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
  if (-not $database) { throw "The database URL must contain a database name." }
  return [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    User = [Uri]::UnescapeDataString($parts[0])
    Password = [Uri]::UnescapeDataString($parts[1])
    Database = $database
  }
}

function Invoke-OrdinoraPostgresTool([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $previous = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL tool failed with exit code $LASTEXITCODE." }
  } finally {
    if ($null -eq $previous) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previous }
  }
}

function Invoke-OrdinoraPostgresQuery([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $previous = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    $output = & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL query failed with exit code $LASTEXITCODE." }
    return $output
  } finally {
    if ($null -eq $previous) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previous }
  }
}
