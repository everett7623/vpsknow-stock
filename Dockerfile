FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vpsknow/database db:generate
# Prisma is generated on Alpine, but the Playwright worker runtime is Ubuntu.
RUN find /app/node_modules -name 'libquery_engine-debian-openssl-3.0.x.so.node' -print -quit | grep -q .
RUN pnpm --filter @vpsknow/worker... build
RUN pnpm --filter @vpsknow/bot... build
RUN pnpm --filter @vpsknow/web build

FROM mcr.microsoft.com/playwright:v1.62.0-noble AS worker-runtime

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY --from=build --chown=pwuser:pwuser /app /app

USER pwuser

CMD ["pnpm", "--filter", "@vpsknow/worker", "start"]

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl \
    && corepack enable

COPY --from=build /app /app

CMD ["pnpm", "--filter", "@vpsknow/worker", "start"]
