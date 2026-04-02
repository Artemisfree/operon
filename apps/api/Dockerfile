FROM node:24-alpine

WORKDIR /workspace

RUN apk add --no-cache libc6-compat openssl

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN corepack enable

EXPOSE 3000
