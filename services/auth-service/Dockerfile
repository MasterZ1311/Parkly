# ============================================================
# Parkly Service Dockerfile — Auth Service Multi-Stage Build
# Usage: Build from repo root with:
#   docker build -f services/auth-service/Dockerfile -t parkly/auth-service .
# ============================================================

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/auth-service/package.json ./services/auth-service/

RUN npm ci --workspace=shared --workspace=services/auth-service --include-workspace-root --ignore-scripts

COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/
COPY infra/prisma/ ./infra/prisma/

RUN apk add --no-cache openssl
RUN npx prisma generate --schema=./infra/prisma/schema.prisma
RUN npm run build -w shared && npm run build -w services/auth-service

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/services/auth-service/package.json ./services/auth-service/package.json
COPY --chown=node:node --from=builder /app/services/auth-service/dist ./services/auth-service/dist

USER node
EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4001/health || exit 1

CMD ["node", "services/auth-service/dist/index.js"]
