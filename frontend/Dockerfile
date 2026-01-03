FROM node:20-alpine

WORKDIR /app

# Installation de Angular CLI
RUN npm install -g @angular/cli

# Copie des fichiers package.json et package-lock.json
COPY package*.json ./

# Installation des dépendances
RUN npm install --legacy-peer-deps

# Copie du reste de l'application
COPY . .

# Port exposé (Angular dev server)
EXPOSE 4200

# Commande de démarrage pour le développement
CMD ["ng", "serve", "--host", "0.0.0.0", "--disable-host-check"]
