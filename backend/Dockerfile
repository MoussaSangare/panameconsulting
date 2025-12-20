# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

# 1. Installez PNPM 19.0.4 via npm
RUN npm install -g pnpm@9.15.4

RUN pnpm install -g corepack@latest

RUN corepack prepare pnpm@latest --activate

WORKDIR /app

# Copie de tout le backend
COPY backend/ ./

# Installation
RUN pnpm install --frozen-lockfile --prefer-offline

# Construction forcée avec configuration modifiée
RUN sed -i 's/"skipLibCheck": false/"skipLibCheck": true/g' tsconfig.json || true
RUN pnpm build 

# ============ ÉTAPE DE PRODUCTION ============
FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=10000

# 1. Installez PNPM 19.0.4 via npm
RUN npm install -g pnpm@9.15.4

RUN pnpm install -g corepack@latest
RUN corepack prepare pnpm@latest --activate

WORKDIR /app

COPY backend/package.json backend/pnpm-lock.yaml* ./

RUN pnpm install --prod --frozen-lockfile --prefer-offline

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

CMD ["node", "dist/main.js"]