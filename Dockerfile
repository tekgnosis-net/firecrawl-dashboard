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
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
