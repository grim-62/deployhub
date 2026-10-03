FROM node:22-alpine

RUN apk add --no-cache docker-cli docker-cli-buildx git
WORKDIR /app
RUN mkdir -p /deployment-nginx && printf '# Deployment routes are generated here.\n' > /deployment-nginx/000-placeholder.conf

COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/src ./src

EXPOSE 5000
CMD ["node", "src/server.js"]