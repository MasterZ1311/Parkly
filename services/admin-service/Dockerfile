FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY packages/ai-agents/package.json ./packages/ai-agents/
COPY services/admin-service/package.json ./services/admin-service/

RUN npm ci --workspace=shared --workspace=packages/ai-agents --workspace=services/admin-service --include-workspace-root --ignore-scripts

COPY shared/ ./shared/
COPY packages/ai-agents/ ./packages/ai-agents/
COPY services/admin-service/ ./services/admin-service/
COPY infra/prisma/ ./infra/prisma/

RUN apk add --no-cache openssl
RUN npx prisma generate --schema=./infra/prisma/schema.prisma
RUN npm run build -w shared && npm run build -w packages/ai-agents && npm run build -w services/admin-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/packages/ai-agents/package.json ./packages/ai-agents/package.json
COPY --chown=node:node --from=builder /app/packages/ai-agents/dist ./packages/ai-agents/dist
COPY --chown=node:node --from=builder /app/services/admin-service/package.json ./services/admin-service/package.json
COPY --chown=node:node --from=builder /app/services/admin-service/dist ./services/admin-service/dist

USER node
EXPOSE 4011

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4011/health || exit 1

CMD ["node", "services/admin-service/dist/index.js"]
