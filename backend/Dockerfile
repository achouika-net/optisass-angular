FROM node:20-alpine

WORKDIR /app

# Installation de nest cli globalement
RUN npm install -g @nestjs/cli

# Copie des fichiers package.json et package-lock.json
COPY package*.json ./

# Installation des dépendances
RUN npm install --legacy-peer-deps

# Copie du schéma Prisma
COPY prisma ./prisma/

# Génération du client Prisma
RUN npx prisma generate

# Copie du reste de l'application
COPY . .

# Construction de l'application
RUN npm run build

# Port exposé
EXPOSE 3000

# Commande de démarrage
# On attend un peu que la DB soit prête, on push le schéma, puis on lance
CMD ["sh", "-c", "npx prisma db push && npm run start:dev"]
