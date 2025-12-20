# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

# Installez PNPM directement via npm
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copie de tout le backend
COPY backend/ ./

# Installation avec pnpm
RUN pnpm install --frozen-lockfile --prefer-offline

# Construction
RUN sed -i 's/"skipLibCheck": false/"skipLibCheck": true/g' tsconfig.json || true
RUN pnpm build 

# ============ ÉTAPE DE PRODUCTION ============
FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=10000

# Installez PNPM pour la production
RUN npm install -g pnpm@9.15.4

WORKDIR /app

COPY backend/package.json backend/pnpm-lock.yaml* ./

# Installation des dépendances de production
RUN pnpm install --prod --frozen-lockfile --prefer-offline

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

CMD ["pnpm", "start"]