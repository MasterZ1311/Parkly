#!/bin/bash
# ============================================================
# Parkly — Local Infrastructure & Database Seed Script
# ============================================================

set -e

echo "🚀 Starting Parkly local infrastructure..."
docker compose up postgres dynamodb-local dynamodb-setup -d

echo "⏳ Waiting for PostgreSQL to be healthy..."
until docker exec parkly-postgres pg_isready -U parkly > /dev/null 2>&1; do
  echo "  Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready."

echo "📦 Running Prisma migrations..."
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
