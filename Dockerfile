# The HTTP transport (src/index-http.ts) for Cloud Run. The service itself -- env, scaling,
# timeout, who may call it -- is Terraform's: infra/gcp/modules/service in prompteye-vibe.
#   docker build -t prompteye-mcp .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src src
RUN npm run build

FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# src/widgets.ts reads the widget pages from ../public relative to dist at runtime.
COPY --chown=node:node public public
USER node
EXPOSE 8080
CMD ["node", "dist/index-http.js"]
