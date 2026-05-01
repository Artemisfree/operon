# Production API image (Railway / any Docker host). Local compose still uses apps/api/Dockerfile.
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

COPY apps ./apps

# Install deps for @operon/api (keeps prisma CLI as devDependency for migrate at startup)
RUN pnpm install --frozen-lockfile --filter @operon/api...

RUN pnpm --filter @operon/api prisma:generate
RUN pnpm --filter @operon/api build

ENV NODE_ENV=production

EXPOSE 3000

# Railway injects PORT; Nest reads process.env.PORT
CMD ["sh", "-c", "pnpm --filter @operon/api prisma:migrate:deploy && pnpm --filter @operon/api start"]
