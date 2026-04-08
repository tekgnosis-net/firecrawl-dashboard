FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
RUN mkdir -p /app/data
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
