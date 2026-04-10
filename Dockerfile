FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache su-exec
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data && chown -R node:node /app/data
ENV NODE_ENV=production
# 3001 = dashboard UI + /api/*, 3101 = transparent Firecrawl proxy
# Single image serves both; docker-compose overrides `command` per service.
EXPOSE 3001 3101
# The default CMD starts the dashboard. The docker-compose `proxy` service
# overrides this to start the proxy instead. The healthcheck probes the
# dashboard's /healthz; docker-compose defines its own healthcheck per service.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/healthz || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server/dashboard.js"]
