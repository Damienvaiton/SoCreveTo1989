FROM node:22-alpine

# Installation des dépendances système nécessaires
# python3 et py3-pip pour faire tourner yt-dlp, ffmpeg pour la conversion
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    curl \
    ca-certificates

# Téléchargement de yt-dlp directement dans le dossier des binaires
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]