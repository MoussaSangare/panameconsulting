# Étape 1 : Build
FROM node:20-alpine AS build-stage
WORKDIR /app

# Installer pnpm
RUN npm install -g pnpm@latest

# Copier uniquement les fichiers de dépendances
COPY package.json pnpm-lock.yaml* ./

# CONFIGURATION SPÉCIALE : On force pnpm à installer en mode "flat" (hoist)
# Cela évite les problèmes de liens symboliques brisés dans Docker
RUN pnpm config set node-linker hoisted && \
    pnpm install --frozen-lockfile

# Copier le reste des fichiers
COPY . .

# Build de l'application
RUN pnpm run build

# Étape 2 : Production
FROM nginx:stable-alpine AS production-stage

# Copier la configuration Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copier les fichiers buildés
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]