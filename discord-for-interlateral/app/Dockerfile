# Node 24 provides the built-in node:sqlite API used by the bridge.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY SKILL.md ./
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY SKILL.md ./
ENV NODE_ENV=production
ENV SQLITE_PATH=/data/bridge.sqlite
RUN mkdir -p /data && chown node:node /data
EXPOSE 8787
VOLUME ["/data"]
USER node
CMD ["node", "dist/index.js"]
