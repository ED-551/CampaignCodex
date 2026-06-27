FROM docker.io/library/node:20-alpine AS builder

ARG VITE_VTT_ENABLED=false
ENV VITE_VTT_ENABLED=$VITE_VTT_ENABLED

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/library/nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# React Router needs all routes to serve index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
