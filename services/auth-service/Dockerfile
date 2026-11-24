# ============================================================
# Parkly Service Dockerfile — Generic Multi-Stage Build
# Usage: Build from repo root with:
#   docker build -f services/<name>/Dockerfile -t parkly/<name> .
# ============================================================

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/auth-service/package.json ./services/auth-service/

# Install dependencies (workspace-aware)
RUN npm ci --workspace=shared --workspace=services/auth-service

# Copy source
COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/
COPY infra/prisma/ ./infra/prisma/

# Generate Prisma client
RUN npx prisma generate --schema=./infra/prisma/schema.prisma

# Build
RUN npm run build -w shared
RUN npm run build -w services/auth-service

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/node_modules ./shared/node_modules
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/services/auth-service/node_modules ./services/auth-service/node_modules

# Expose service port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4001/health || exit 1

CMD ["node", "services/auth-service/dist/index.js"]
