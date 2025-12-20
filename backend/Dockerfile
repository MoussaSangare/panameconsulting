# Stage 1: Builder
FROM node:18-alpine AS builder

# Install pnpm globalement
RUN npm install -g pnpm@9.15.4

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY backend/package.json backend/pnpm-lock.yaml* ./

# Installer toutes les dépendances
RUN pnpm install --frozen-lockfile

# Copier le code source
COPY backend/ ./

# Builder l'application
RUN pnpm build

# Vérifier que la build a réussi
RUN ls -la dist/ && echo "=== Fichier main.js existe ? ===" && test -f dist/main.js && echo "OUI" || echo "NON"

# Stage 2: Production
FROM node:18-alpine AS production

# Installer pnpm pour la production
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour la production
COPY --from=builder /app/dist ./dist
COPY backend/package.json backend/pnpm-lock.yaml* ./

# Installer uniquement les dépendances de production
RUN pnpm install --prod --frozen-lockfile

# L'utilisateur 'node' existe déjà dans l'image Node.js alpine
# On ajuste juste les permissions

# Créer les dossiers nécessaires AVANT de changer les permissions
RUN mkdir -p /app/uploads /app/logs

# Définir les permissions appropriées
RUN chown -R node:node /app && \
    chmod -R 755 /app && \
    chmod -R 775 /app/uploads /app/logs

# Basculer vers l'utilisateur non-root existant
USER node

# Exposer le port
EXPOSE 10000

# Variables d'environnement
ENV PORT=10000
ENV NODE_ENV=production

# Commande de démarrage
CMD ["node", "dist/main.js"]