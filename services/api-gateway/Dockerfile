FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/api-gateway/package.json ./services/api-gateway/

RUN npm ci --workspace=shared --workspace=services/api-gateway --if-present

COPY shared/ ./shared/
COPY services/api-gateway/ ./services/api-gateway/
COPY infra/prisma/ ./infra/prisma/

RUN npx prisma generate --schema=./infra/prisma/schema.prisma 2>/dev/null || true
RUN npm run build -w shared
RUN npm run build -w services/api-gateway

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4000/health || exit 1

CMD ["node", "services/api-gateway/dist/index.js"]
