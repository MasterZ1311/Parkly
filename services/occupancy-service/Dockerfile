FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/occupancy-service/package.json ./services/occupancy-service/

RUN npm ci --workspace=shared --workspace=services/occupancy-service --include-workspace-root --ignore-scripts

COPY shared/ ./shared/
COPY services/occupancy-service/ ./services/occupancy-service/

RUN npm run build -w shared && npm run build -w services/occupancy-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/services/occupancy-service/package.json ./services/occupancy-service/package.json
COPY --chown=node:node --from=builder /app/services/occupancy-service/dist ./services/occupancy-service/dist

USER node
EXPOSE 4007

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4007/health || exit 1

CMD ["node", "services/occupancy-service/dist/index.js"]
