FROM docker.io/library/node:20-alpine

ENV NODE_ENV=production \
    DOTENV_CONFIG_QUIET=true
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Uploads live on a volume mounted here. Creating it in the image with the
# right owner means a fresh named volume inherits that ownership.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health > /dev/null || exit 1

# Applies schema + migrations and seeds the admin account, then runs CMD.
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
