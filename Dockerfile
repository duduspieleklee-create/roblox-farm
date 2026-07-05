FROM mcr.microsoft.com/playwright:v1.48.0-jammy

RUN apt-get update && apt-get install -y curl socat && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["sh", "-c", "PUB=${CDP_PORT:-9222}; INT=$((PUB+1)); socat TCP-LISTEN:$PUB,fork,reuseaddr TCP:127.0.0.1:$INT & exec node manager.js"]
