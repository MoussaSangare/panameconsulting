
FROM node:18-alpine

WORKDIR /app

# Copie les fichiers de config
COPY package.json pnpm-lock.yaml tsconfig*.json nest-cli.json ./

# Active pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Installation
RUN pnpm install --frozen-lockfile --prefer-offline

# Copie le code source
COPY . .


# Build
RUN pnpm build

# Dossiers pour les uploads
RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app

USER node

EXPOSE 10000

CMD ["node", "dist/main.js"]