#!/bin/bash
# ============================================================
# Parkly — Local Infrastructure & Database Seed Script
# ============================================================

set -e

echo "🚀 Starting Parkly local infrastructure..."
docker compose up postgres dynamodb-local dynamodb-setup -d

echo "⏳ Waiting for PostgreSQL to be healthy..."
retries=30
until docker exec parkly-postgres pg_isready -U parkly -d parkly > /dev/null 2>&1; do
  retries=$((retries - 1))
  if [ "$retries" -le 0 ]; then
    echo "❌ PostgreSQL failed to become healthy. Aborting without running migrations or seeds."
    exit 1
  fi
  echo "  Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready."

# Pin explicitly to local Docker Postgres in development mode (never inherit remote DATABASE_URL)
export NODE_ENV=development
export DATABASE_URL="postgresql://parkly:password@localhost:5432/parkly?schema=public"

echo "📦 Building @parkly/shared & running Prisma migrations..."
npm run build -w shared
npx prisma migrate deploy --schema=infra/prisma/schema.prisma

echo "🌱 Seeding Chennai sample parking spaces, users, and rates..."
npx ts-node infra/prisma/seed.ts

echo ""
echo "🎉 Parkly local environment successfully initialized!"
echo "----------------------------------------------------"
echo "  PostgreSQL:        postgresql://parkly:password@localhost:5432/parkly"
echo "  DynamoDB Local:    http://localhost:8000"
echo "  Prisma Studio:     run 'npm run prisma:studio' (http://localhost:5555)"
echo "  API Gateway:       http://localhost:4000/health"
echo "  Host Dashboard:    http://localhost:3001"
echo "  Admin Portal:      http://localhost:3002"
echo "----------------------------------------------------"
