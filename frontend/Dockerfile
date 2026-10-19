# The build output is static files, so build on the native platform even when
# producing an arm64 image — much faster than building under emulation.
FROM --platform=$BUILDPLATFORM docker.io/library/node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/library/nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# React Router needs all routes to serve index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Writes /config.js from env vars (e.g. VTT_ENABLED) each time the container starts
COPY docker-entrypoint.d/ /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/40-campaigncodex-config.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
