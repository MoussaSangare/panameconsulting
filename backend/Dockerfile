# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

WORKDIR /app

# Installation de pnpm
RUN npm install -g pnpm@9.15.4

# Copie des fichiers de dépendances
COPY backend/package.json backend/pnpm-lock.yaml backend/tsconfig*.json ./

# Installation des dépendances
RUN pnpm install --frozen-lockfile

# Copie du code source
COPY backend/ ./

# Construction
RUN pnpm build

# ============ ÉTAPE DE PRODUCTION ============
FROM node:18-alpine

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=10000

WORKDIR /app

# Installation de pnpm dans l'image finale (IMPORTANT pour Railway)
RUN npm install -g pnpm@9.15.4

# Copie des fichiers de package
COPY backend/package.json backend/pnpm-lock.yaml ./

# Installation des dépendances avec pnpm
RUN pnpm install --prod --frozen-lockfile

# Copie des fichiers construits depuis le builder
COPY --from=builder /app/dist ./dist

# Copie des fichiers de configuration si nécessaire
COPY --from=builder /app/.env* ./
COPY --from=builder /app/tsconfig*.json ./

# Création des répertoires nécessaires
RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

# Railway utilise souvent pnpm start, assurez-vous que le script start fonctionne
CMD ["node", "dist/main.js"]