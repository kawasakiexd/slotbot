# syntax=docker/dockerfile:1
FROM node:24-slim AS base
ENV TZ=UTC
RUN npm install -g pnpm@12.11.2
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm pnpm fetch --store-dir /var/cache/pnpm
COPY . .
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --offline --frozen-lockfile --store-dir /var/cache/pnpm
RUN pnpm -r --if-present build
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --offline --frozen-lockfile --prod --filter @slotbot/bot --store-dir /var/cache/pnpm

FROM node:24-slim AS runtime
ENV NODE_ENV=production TZ=UTC APP_ROOT=/app/apps/bot
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/drizzle ./apps/bot/drizzle
COPY --from=build /app/apps/bot/locales ./apps/bot/locales
COPY --from=build /app/apps/bot/content ./apps/bot/content
USER node
WORKDIR /app/apps/bot
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/index.js"]
