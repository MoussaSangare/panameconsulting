# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

# FORCER l'utilisation d'une version spécifique de pnpm SANS Corepack
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copie des fichiers nécessaires pour l'installation
COPY backend/package.json backend/pnpm-lock.yaml* ./

# Installation des dépendances
RUN pnpm install --frozen-lockfile

# Copie du reste du code source
COPY backend/ ./

# Construction
RUN pnpm build --verbose

# Pour vérifier que le fichier main.js est bien généré
RUN ls -la dist/ && echo "=== Fichier main.js existe ? ===" && test -f dist/main.js && echo "OUI" || echo "NON"

# ============ ÉTAPE DE PRODUCTION ============
FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=10000

# Installation directe de pnpm (sans Corepack buggé)
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copie des fichiers de dépendances
COPY backend/package.json backend/pnpm-lock.yaml* ./

# Installation des dépendances de production
RUN pnpm install --prod --frozen-lockfile

# Copie des fichiers construits
COPY --from=builder /app/dist ./dist

# Création des dossiers nécessaires
RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

CMD ["node", "dist/main.js"]