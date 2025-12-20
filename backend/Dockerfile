# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

RUN npm install -g corepack@latest
RUN corepack enable
RUN corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copie de tout le backend
COPY backend/ ./

# Installation
RUN pnpm install --frozen-lockfile --prefer-offline
RUN pnpm add @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11

# Construction forcée avec configuration modifiée
RUN sed -i 's/"skipLibCheck": false/"skipLibCheck": true/g' tsconfig.json || true
RUN pnpm build 

# ============ ÉTAPE DE PRODUCTION ============
FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=10000

RUN npm install -g corepack@latest
RUN corepack enable
RUN corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY backend/package.json backend/pnpm-lock.yaml* ./

RUN pnpm install --prod --frozen-lockfile --prefer-offline

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

CMD ["node", "dist/main.js"]