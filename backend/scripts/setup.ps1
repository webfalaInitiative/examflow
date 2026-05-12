<#
  backend/scripts/setup.ps1

  Interactive PowerShell script to:
  - create a Postgres DB user and database (requires postgres superuser credentials)
  - write `backend/.env` with DATABASE_URL and seed credentials
  - install npm deps, generate Prisma client, run migrations and seed

  Usage (PowerShell, run as a user who can run psql):
  PowerShell -ExecutionPolicy Bypass -File .\backend\scripts\setup.ps1

  Notes:
  - `psql` must be in your PATH (Postgres CLI). If not, run the SQL manually in pgAdmin.
  - This script is interactive and will ask for passwords.
#>

function Read-SecureStringPlain([string]$prompt) {
  $s = Read-Host -AsSecureString $prompt
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) | Out-Null
  return $plain
}

Write-Host "=== Exam Flow backend setup ===" -ForegroundColor Cyan

$pgSuperUser = Read-Host "Postgres superuser name (default: postgres)"
if ([string]::IsNullOrWhiteSpace($pgSuperUser)) { $pgSuperUser = 'postgres' }
$pgSuperPass = Read-SecureStringPlain "Postgres superuser password (input hidden)"

$dbUser = Read-Host "Database user to create (default: examuser)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = 'examuser' }
$dbPass = Read-SecureStringPlain "Password for new DB user (input hidden)"

$dbName = Read-Host "Database name (default: examflow)"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'examflow' }

Write-Host "Checking psql availability..."
try {
  $psqlPath = (Get-Command psql -ErrorAction Stop).Source
} catch {
  Write-Error "psql not found in PATH. Install Postgres cli or run the SQL manually via pgAdmin."
  exit 1
}

# Move to backend root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendRoot = Resolve-Path "$scriptDir\.."
Set-Location $backendRoot

# Use PGPASSWORD for non-interactive psql
$env:PGPASSWORD = $pgSuperPass

Write-Host "Creating database user and database..."
try {
  & psql -U $pgSuperUser -h localhost -c "CREATE USER \"$dbUser\" WITH PASSWORD '$dbPass';" 2>&1 | Write-Host
  & psql -U $pgSuperUser -h localhost -c "CREATE DATABASE \"$dbName\" OWNER \"$dbUser\";" 2>&1 | Write-Host
  & psql -U $pgSuperUser -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE \"$dbName\" TO \"$dbUser\";" 2>&1 | Write-Host
} catch {
  Write-Warning "One or more psql commands failed. If objects already exist this may be benign. Check output above."
}

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "Writing .env file in backend root..."
$jwt = [Guid]::NewGuid().ToString() + (Get-Random -Minimum 1000 -Maximum 9999)

$seedOwnerEmail = Read-Host "Seed owner email (default: owner@example.com)"
if ([string]::IsNullOrWhiteSpace($seedOwnerEmail)) { $seedOwnerEmail = 'owner@example.com' }
$seedOwnerPass = Read-SecureStringPlain "Seed owner password (default: ChangeMe123!) (input hidden)"
if ([string]::IsNullOrWhiteSpace($seedOwnerPass)) { $seedOwnerPass = 'ChangeMe123!' }

$seedAdminEmail = Read-Host "(Optional) Seed admin email (leave blank to skip)"
if (![string]::IsNullOrWhiteSpace($seedAdminEmail)) {
  $seedAdminPass = Read-SecureStringPlain "Seed admin password (input hidden)"
}

$envContent = @()
$envContent += "PORT=5000"
$envContent += "DATABASE_URL=postgresql://$dbUser:$dbPass@localhost:5432/$dbName"
$envContent += "JWT_SECRET=$jwt"
$envContent += "NODE_ENV=development"
$envContent += "SEED_OWNER_EMAIL=$seedOwnerEmail"
$envContent += "SEED_OWNER_PASSWORD=$seedOwnerPass"
if (![string]::IsNullOrWhiteSpace($seedAdminEmail)) {
  $envContent += "SEED_ADMIN_EMAIL=$seedAdminEmail"
  $envContent += "SEED_ADMIN_PASSWORD=$seedAdminPass"
}

Set-Content -Path ".env" -Value ($envContent -join "`n") -Encoding UTF8

Write-Host "Installing backend dependencies (npm install)..." -ForegroundColor Yellow
npm install

Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "Applying Prisma migrations (dev)..." -ForegroundColor Yellow
npx prisma migrate dev --name init --skip-seed

Write-Host "Running seed script..." -ForegroundColor Yellow
npm run prisma:seed

Write-Host "Setup finished. Start backend with: npm run dev" -ForegroundColor Green
Write-Host "Start frontend from repo root: cd frontend ; npm install ; npm run dev" -ForegroundColor Green

exit 0
