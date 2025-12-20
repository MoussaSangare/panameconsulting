# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances
COPY backend/package.json backend/pnpm-lock.yaml ./

# Installation de pnpm globalement
RUN npm install -g pnpm@9.15.4

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

# Copie uniquement les fichiers nécessaires pour l'exécution
COPY backend/package.json ./

# Installation des dépendances de production
# Utilisez npm pour éviter d'installer pnpm en production
RUN npm install --omit=dev --frozen-lockfile

# Copie des fichiers construits
COPY --from=builder /app/dist ./dist

# Création des répertoires nécessaires
RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

# Commande corrigée
CMD ["node", "dist/main.js"]