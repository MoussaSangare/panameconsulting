# ============ BUILD ============
FROM node:18-alpine AS builder

WORKDIR /app

# Active pnpm via corepack (version fixée)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY backend/ ./

RUN pnpm install --frozen-lockfile
RUN pnpm build

# ============ PRODUCTION ============
FROM node:18-alpine

ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY backend/package.json backend/pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads logs \
 && chown -R node:node /app

USER node

EXPOSE 10000
CMD ["node", "dist/main.js"]
