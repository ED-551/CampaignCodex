FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p uploads/portraits

EXPOSE 3001

CMD ["node", "src/index.js"]
