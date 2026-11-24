# ============================================================
# Stage 1: Build static assets
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifest
COPY package.json ./

# Install dependencies (use npm install to resolve dependencies from package.json)
RUN npm install --no-audit --no-fund

# Copy application source and build configuration
COPY . .

# Compile TypeScript and Vite production bundle
RUN npm run build

# ============================================================
# Stage 2: Production runtime with unprivileged Nginx
# ============================================================
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# Copy hardened Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose unprivileged HTTP port
EXPOSE 8080

# Health check to ensure Nginx serves requests
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/health || exit 1

# Launch Nginx in foreground as unprivileged user 'nginx' (UID 101)
USER 101
CMD ["nginx", "-g", "daemon off;"]
