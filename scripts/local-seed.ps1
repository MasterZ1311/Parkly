# ============================================================
# Parkly — Local Infrastructure & Database Seed Script (PowerShell)
# ============================================================

Write-Host "🚀 Starting Parkly local infrastructure..." -ForegroundColor Cyan
docker compose up postgres dynamodb-local dynamodb-setup -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "⏳ Waiting for PostgreSQL to be healthy..." -ForegroundColor Yellow
$healthy = $false
$retries = 15
while (-not $healthy -and $retries -gt 0) {
    try {
        docker exec parkly-postgres pg_isready -U parkly -d parkly 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $healthy = $true
        } else {
            Start-Sleep -Seconds 2
            $retries--
        }
    } catch {
        Start-Sleep -Seconds 2
        $retries--
    }
}

if (-not $healthy) {
    Write-Error "❌ PostgreSQL failed to become healthy within 30s. Aborting without running migrations or seeds."
    exit 1
}
Write-Host "✅ PostgreSQL is ready." -ForegroundColor Green

# Pin explicitly to local Docker Postgres in development mode (never inherit remote DATABASE_URL)
$env:NODE_ENV = "development"
$env:DATABASE_URL = "postgresql://parkly:password@localhost:5432/parkly?schema=public"

Write-Host "📦 Building @parkly/shared & running Prisma migrations..." -ForegroundColor Cyan
npm run build -w shared
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx prisma migrate deploy --schema=infra/prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "🌱 Seeding Chennai sample parking spaces, users, and rates..." -ForegroundColor Cyan
npx ts-node infra/prisma/seed.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "🎉 Parkly local environment successfully initialized!" -ForegroundColor Green
Write-Host "----------------------------------------------------" -ForegroundColor Gray
Write-Host "  PostgreSQL:        postgresql://parkly:password@localhost:5432/parkly"
Write-Host "  DynamoDB Local:    http://localhost:8000"
Write-Host "  API Gateway:       http://localhost:4000/health"
Write-Host "  Host Dashboard:    http://localhost:3001"
Write-Host "  Admin Portal:      http://localhost:3002"
Write-Host "----------------------------------------------------" -ForegroundColor Gray
