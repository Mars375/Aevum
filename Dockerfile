# Builds the static replay player. Battles are run from the CLI, not from the
# container: the container serves finished replays, it never calls a model.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/engine/package.json packages/engine/
COPY packages/agents/package.json packages/agents/
COPY packages/cli/package.json packages/cli/
COPY apps/player/package.json apps/player/
RUN npm ci

COPY . .
RUN npm run player:build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/apps/player/dist /usr/share/nginx/html
COPY apps/player/nginx.conf /etc/nginx/conf.d/default.conf

# Replays are mounted read-only at runtime rather than baked into the image, so
# publishing a new battle never means rebuilding.
VOLUME ["/usr/share/nginx/html/replays"]
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
