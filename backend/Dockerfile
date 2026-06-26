FROM docker.io/library/node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p uploads/portraits

EXPOSE 3001

# Run migrations (idempotent — safe to re-run on each deploy) then start the server
CMD ["sh", "-c", "node scripts/migrate.js && node src/index.js"]
