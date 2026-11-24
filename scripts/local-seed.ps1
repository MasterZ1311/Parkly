# ============================================================
# Parkly — Local Infrastructure & Database Seed Script (PowerShell)
# ============================================================

Write-Host "🚀 Starting Parkly local infrastructure..." -ForegroundColor Cyan
docker compose up postgres dynamodb-local dynamodb-setup -d

Write-Host "⏳ Waiting for PostgreSQL to be healthy..." -ForegroundColor Yellow
$healthy = $false
$retries = 15
while (-not $healthy -and $retries -gt 0) {
    try {
        $result = docker exec parkly-postgres pg_isready -U parkly 2>$null
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

if ($healthy) {
    Write-Host "✅ PostgreSQL is ready." -ForegroundColor Green
} else {
    Write-Host "⚠️ Proceeding with migration..." -ForegroundColor DarkYellow
}

Write-Host "📦 Running Prisma migrations..." -ForegroundColor Cyan
npx prisma migrate deploy --schema=infra/prisma/schema.prisma

Write-Host "🌱 Seeding Chennai sample parking spaces, users, and rates..." -ForegroundColor Cyan
npx ts-node infra/prisma/seed.ts

Write-Host ""
Write-Host "🎉 Parkly local environment successfully initialized!" -ForegroundColor Green
Write-Host "----------------------------------------------------" -ForegroundColor Gray
Write-Host "  PostgreSQL:        postgresql://parkly:password@localhost:5432/parkly"
Write-Host "  DynamoDB Local:    http://localhost:8000"
Write-Host "  API Gateway:       http://localhost:4000/health"
Write-Host "  Host Dashboard:    http://localhost:3001"
Write-Host "  Admin Portal:      http://localhost:3002"
Write-Host "----------------------------------------------------" -ForegroundColor Gray
