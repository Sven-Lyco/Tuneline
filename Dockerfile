# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Accept VITE_* build-time variables (injected by Coolify or docker build --build-arg)
ARG VITE_SERVER_URL

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

# Always install all deps (incl. devDependencies) in builder — NODE_ENV=production would skip them
RUN NODE_ENV=development npm ci

# Copy source
COPY shared/ ./shared/
COPY client/ ./client/
COPY server/ ./server/

# Build client (Vite) and server (tsup)
RUN npm run build -w @tuneline/client
RUN npm run build -w @tuneline/server

# ─── Production stage ────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Security fixes for Alpine packages that are newer than the base image
RUN apk upgrade --no-cache

# Install only server runtime dependencies
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

# npm and corepack are only needed for the install; the running server never uses them,
# so they (and their dependencies) don't ship. busybox wget stays for health checks.
RUN npm ci --omit=dev && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Copy build artifacts
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist

ENV NODE_ENV=production
ENV PORT=3001

# Run unprivileged: the server only reads its files and logs to stdout.
USER node

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
