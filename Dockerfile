FROM node:22-alpine

# 1. Installation de tzdata (obligatoire sur Alpine pour changer l'heure)
# On garde aussi python3, ffmpeg et curl pour tes autres fonctions
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
    tzdata

# 2. Configuration du fuseau horaire
ENV TZ=Europe/Paris

# 3. Installation de yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]