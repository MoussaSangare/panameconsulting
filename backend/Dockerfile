# ============ ÉTAPE DE BUILD ============
FROM node:18-alpine AS builder

WORKDIR /app

# Configuration optimisée pour Docker

# Copie des fichiers de dépendances d'abord (meilleur cache)
COPY backend/package.json backend/pnpm-lock.yaml* ./

# Installez nodemailer DANS la phase de build seulement
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
RUN pnpm install nodemailer@latest @types/nodemailer@latest --save-dev

# Installation complète pour le build
RUN pnpm install --frozen-lockfile --prefer-offline

# Copie du reste du code
COPY backend/ ./

# Construction
RUN sed -i 's/"skipLibCheck": false/"skipLibCheck": true/g' tsconfig.json || true
RUN pnpm build

# ============ ÉTAPE DE PRODUCTION ============
FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=10000

WORKDIR /app

# Copie des fichiers de dépendances
COPY --from=builder /app/package.json /app/pnpm-lock.yaml* ./

# Installation de production UNIQUEMENT
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
RUN pnpm install --prod --frozen-lockfile --prefer-offline

# Copie des fichiers construits
COPY --from=builder /app/dist ./dist

# Création des répertoires avec les bonnes permissions
RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE $PORT

CMD ["node", "dist/main.js"]