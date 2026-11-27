FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/booking-service/package.json ./services/booking-service/

RUN npm ci --workspace=shared --workspace=services/booking-service --include-workspace-root --ignore-scripts

COPY shared/ ./shared/
COPY services/booking-service/ ./services/booking-service/
COPY infra/prisma/ ./infra/prisma/

RUN apk add --no-cache openssl
RUN npx prisma generate --schema=./infra/prisma/schema.prisma
RUN npm run build -w shared && npm run build -w services/booking-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/services/booking-service/package.json ./services/booking-service/package.json
COPY --chown=node:node --from=builder /app/services/booking-service/dist ./services/booking-service/dist

USER node
EXPOSE 4002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4002/health || exit 1

CMD ["node", "services/booking-service/dist/index.js"]
