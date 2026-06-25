FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/search-service/package.json ./services/search-service/

RUN npm ci --workspace=shared --workspace=services/search-service --if-present

COPY shared/ ./shared/
COPY services/search-service/ ./services/search-service/
COPY infra/prisma/ ./infra/prisma/

RUN npx prisma generate --schema=./infra/prisma/schema.prisma 2>/dev/null || true
RUN npm run build -w shared
RUN npm run build -w services/search-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/search-service/dist ./services/search-service/dist

EXPOSE 4004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4004/health || exit 1

CMD ["node", "services/search-service/dist/index.js"]
