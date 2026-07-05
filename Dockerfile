FROM mcr.microsoft.com/playwright:v1.48.0-jammy

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["node", "manager.js"]
