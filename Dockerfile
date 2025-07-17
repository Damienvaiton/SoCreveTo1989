# Utilisez une image Node.js officielle comme base.
# Nous choisissons une version LTS alpine pour une taille d'image réduite.
FROM node:18-alpine

# Définissez le répertoire de travail dans le conteneur.
# Toutes les commandes suivantes seront exécutées à partir de ce répertoire.
WORKDIR /app

# Copiez les fichiers package.json et package-lock.json (ou yarn.lock)
# C'est une bonne pratique de copier ces fichiers d'abord pour profiter du cache Docker,
# car ils changent moins souvent que le code source.
COPY package*.json ./

# Installez les dépendances du projet.
RUN npm install

# Copiez le reste du code source de votre application dans le conteneur.
# Le '.' à la fin signifie "copier tout le contenu du répertoire courant de l'hôte
# vers le répertoire de travail '/app' dans le conteneur".
COPY . .

# Compilez votre code TypeScript en JavaScript
# Assurez-vous que cette commande correspond à votre script de build.
RUN npm run build

# Exposez le port si votre bot devait écouter des requêtes HTTP (peu commun pour un bot Discord pur,
# mais utile si vous avez une API web intégrée). Pour un bot simple, vous pouvez l'omettre.
# EXPOSE 3000

# Commande par défaut à exécuter lorsque le conteneur démarre.
# Ici, nous lançons votre bot en utilisant le script 'start' défini dans package.json.
CMD ["npm", "run", "start"]