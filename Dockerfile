# ---- build client ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001 DB_FILE=/data/ajaia.db
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=client /app/client/dist ./client/dist
VOLUME /data
EXPOSE 3001
WORKDIR /app/server
CMD ["node", "--no-warnings", "src/index.js"]
