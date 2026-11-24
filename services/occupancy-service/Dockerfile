FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/occupancy-service/package.json ./services/occupancy-service/

RUN npm ci --workspace=shared --workspace=services/occupancy-service --if-present

COPY shared/ ./shared/
COPY services/occupancy-service/ ./services/occupancy-service/
COPY infra/prisma/ ./infra/prisma/

RUN npx prisma generate --schema=./infra/prisma/schema.prisma 2>/dev/null || true
RUN npm run build -w shared
RUN npm run build -w services/occupancy-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/occupancy-service/dist ./services/occupancy-service/dist

EXPOSE 4007

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4007/health || exit 1

CMD ["node", "services/occupancy-service/dist/index.js"]
