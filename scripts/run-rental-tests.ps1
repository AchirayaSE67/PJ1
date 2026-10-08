Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
  throw 'Dependencies are missing. Run npm ci in the PJ1 folder first.'
}

$template = Read-Host 'Paste the finaly Session pooler URI, leaving [YOUR-PASSWORD] unchanged'
if (-not $template.Contains('[YOUR-PASSWORD]')) {
  throw 'The URI must contain [YOUR-PASSWORD]. Do not paste a URI that already contains the password.'
}

$password = Read-Host 'Database password (hidden)' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $password).Password
$databaseUrl = $template.Replace('[YOUR-PASSWORD]', [System.Uri]::EscapeDataString($plainPassword))
$plainPassword = $null
$password.Dispose()

try {
  $uri = [System.Uri]::new($databaseUrl)
} catch {
  throw 'The connection URI is invalid. Copy it again from Supabase Connect > Session pooler.'
}
if ($uri.Scheme -notin @('postgres', 'postgresql') -or
    -not $uri.Host.EndsWith('.pooler.supabase.com') -or
    $uri.Port -ne 5432 -or
    $uri.AbsolutePath -ne '/postgres') {
  throw 'Use the Session pooler URI from Supabase Connect (pooler host, port 5432, database postgres).'
}

$confirmation = Read-Host 'Type YES to confirm this URI is for the separate finaly test project'
if ($confirmation -cne 'YES') { throw 'Test run cancelled before any database write.' }

$envNames = @('DATABASE_URL', 'TEST_DATABASE_URL', 'DB_SSL', 'JWT_SECRET', 'TEST_DB_ISOLATED', 'TEST_BASE_URL', 'PORT')
$previous = @{}
foreach ($name in $envNames) {
  $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  $previous[$name] = if ($null -eq $item) { $null } else { $item.Value }
}

$serverProcess = $null
try {
  if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) {
    throw 'Port 3000 is already in use. Stop the existing local server before this run.'
  }

  $env:DATABASE_URL = $databaseUrl
  $env:TEST_DATABASE_URL = $databaseUrl
  $env:DB_SSL = 'true'
  $env:JWT_SECRET = [System.Guid]::NewGuid().ToString('N')
  $env:TEST_DB_ISOLATED = 'yes'
  $env:TEST_BASE_URL = 'http://localhost:3000'
  $env:PORT = '3000'
  $databaseUrl = $null

  & node scripts/rental-db-preflight.js
  if ($LASTEXITCODE -ne 0) { throw 'Database preflight failed; no test fixtures were created.' }

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $serverProcess = Start-Process -FilePath $nodePath -ArgumentList 'backend/server.js' -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru

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
  if ($LASTEXITCODE -ne 0) { throw 'At least one rental test failed. Review the test output above.' }
  Write-Host 'All four rental tests passed.'
} finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
  }
  foreach ($name in $envNames) {
    if ($null -eq $previous[$name]) {
      Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    } else {
      Set-Item -Path "Env:$name" -Value $previous[$name]
    }
  }
}
