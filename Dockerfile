# syntax=docker/dockerfile:1.7
#
# Aerowell production image: one container serves the API and the built React app.
#
#   docker build --build-arg VITE_API_URL=https://your-domain -t aerowell .
#
# VITE_API_URL is baked into the frontend bundle at build time (Vite replaces it
# in the JavaScript), so it must be the public address browsers use to reach this
# container: the ALB DNS name or your domain, without a trailing slash.

ARG NODE_VERSION=22

# ---------- 1. Build the React frontend ----------
FROM node:${NODE_VERSION}-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---------- 2. Install backend production dependencies ----------
FROM node:${NODE_VERSION}-alpine AS backend-deps
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- 3. Runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime

# tini forwards SIGTERM to node, so `docker stop` shuts the server down cleanly
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=5000 \
    FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend

COPY --from=backend-deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --chown=node:node backend/ ./
COPY --chown=node:node cli/ /app/cli/
COPY --from=frontend-build --chown=node:node /app/frontend/dist /app/frontend/dist

# Local-disk fallback for uploads when S3 isn't configured (mounted as a volume on EC2)
RUN mkdir -p /app/backend/uploads && chown node:node /app/backend/uploads

USER node
EXPOSE 5000

# Same endpoint the ALB checks: 200 when the server is up and MongoDB is connected
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "app.js"]
