FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/api-gateway/package.json ./services/api-gateway/

RUN npm ci --workspace=shared --workspace=services/api-gateway --include-workspace-root --ignore-scripts

COPY shared/ ./shared/
COPY services/api-gateway/ ./services/api-gateway/

RUN npm run build -w shared && npm run build -w services/api-gateway

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/services/api-gateway/package.json ./services/api-gateway/package.json
COPY --chown=node:node --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:4000/health || exit 1

CMD ["node", "services/api-gateway/dist/index.js"]
