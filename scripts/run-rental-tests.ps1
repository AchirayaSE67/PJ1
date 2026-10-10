Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
  throw 'Dependencies are missing. Run npm ci in the PJ1 folder first.'
}

& docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running. Start it and run this script again.' }
if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) {
  throw 'Port 3000 is already in use. Stop the existing local server before this run.'
}

$port = 55432
if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
  throw "Port $port is already in use. Stop that service before this run."
}

$containerName = 'pj1-rental-test-' + [System.Guid]::NewGuid().ToString('N').Substring(0, 12)
$localPassword = [System.Guid]::NewGuid().ToString('N')
$envNames = @('DATABASE_URL', 'TEST_DATABASE_URL', 'DB_SSL', 'JWT_SECRET', 'TEST_DB_ISOLATED', 'TEST_BASE_URL', 'PORT', 'POSTGRES_PASSWORD')
$previous = @{}
foreach ($name in $envNames) {
  $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  $previous[$name] = if ($null -eq $item) { $null } else { $item.Value }
}

$serverProcess = $null
$containerStarted = $false
$serverLog = Join-Path $env:TEMP ("pj1-rental-server-$containerName.log")
$serverErrorLog = Join-Path $env:TEMP ("pj1-rental-server-$containerName.err.log")
try {
  $env:POSTGRES_PASSWORD = $localPassword
  & docker run --detach --name $containerName --publish "127.0.0.1:${port}:5432" --env POSTGRES_PASSWORD postgres:16-alpine | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not start disposable PostgreSQL container.' }
  $containerStarted = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    & docker exec $containerName pg_isready -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }

  & docker cp 'database/schema.sql' "${containerName}:/tmp/schema.sql"
  if ($LASTEXITCODE -ne 0) { throw 'Could not copy schema into disposable PostgreSQL.' }
  & docker exec $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/schema.sql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Schema initialization failed.' }

  $databaseUrl = "postgresql://postgres:${localPassword}@127.0.0.1:${port}/postgres"
  $env:DATABASE_URL = $databaseUrl
  $env:TEST_DATABASE_URL = $databaseUrl
  $env:DB_SSL = 'false'
  $env:JWT_SECRET = [System.Guid]::NewGuid().ToString('N')
  $env:TEST_DB_ISOLATED = 'yes'
  $env:TEST_BASE_URL = 'http://localhost:3000'
  $env:PORT = '3000'
  $databaseUrl = $null
  $localPassword = $null

  & node scripts/rental-db-preflight.js
  if ($LASTEXITCODE -ne 0) { throw 'Database preflight failed.' }

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $serverProcess = Start-Process -FilePath $nodePath -ArgumentList 'backend/server.js' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($serverProcess.HasExited) { throw 'Local server stopped during startup.' }
    try {
      $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/computers' -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $ready) { throw 'Local server did not become ready on port 3000.' }

  & npm run test:rental
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath $serverErrorLog) { Get-Content -LiteralPath $serverErrorLog }
    if (Test-Path -LiteralPath $serverLog) { Get-Content -LiteralPath $serverLog }
    throw 'At least one rental test failed. Review the test output above.'
  }
  Write-Host 'All four rental tests passed.'
} finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
  }
  if ($containerStarted) { & docker rm --force $containerName | Out-Null }
  Remove-Item -LiteralPath $serverLog, $serverErrorLog -ErrorAction SilentlyContinue
  foreach ($name in $envNames) {
    if ($null -eq $previous[$name]) {
      Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    } else {
      Set-Item -Path "Env:$name" -Value $previous[$name]
    }
  }
}
