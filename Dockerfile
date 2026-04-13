FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/src ./src
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
RUN chown -R nodeapp:nodejs /app
USER nodeapp
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
