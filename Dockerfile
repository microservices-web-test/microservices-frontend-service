# syntax=docker/dockerfile:1

# ---- Build stage: compile the React + Vite app into static assets ----
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle.
COPY . .
RUN npm run build

# ---- Runtime stage: serve the static bundle with nginx ----
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

# Patch OS packages so the shipped image picks up Alpine security fixes that
# the base image tag may lag behind (clears fixable HIGH/CRITICAL CVEs).
USER root
RUN apk upgrade --no-cache

# Unprivileged nginx runs as uid 101 ("nginx") and can bind :8080 (not :80).
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Drop back to the non-root user for runtime.
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
