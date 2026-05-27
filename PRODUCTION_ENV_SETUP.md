# Production Environment Setup

This document describes the production environment variables for the three
services involved in the FLOR Dubai chat assistant integration.

## 1. FLOR Backend

Project path:
Required production variables:
```env
APP_NAME=flordubai_web
ENVIRONMENT=production
DEBUG=false

DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB_NAME
REDIS_URL=redis://USER:PASSWORD@HOST:6379/0

SECRET_KEY=long_random_secret_32_chars_minimum
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

CORS_ORIGINS=https://your-frontend-domain.com

PAYMOB_API_KEY=...
PAYMOB_MERCHANT_ID=...
PAYMOB_SECRET=...
PAYMOB_INTEGRATION_ID=...
PAYMOB_APPLEPAY_INTEGRATION_ID=...
PAYMOB_IFRAME_ID=...
PAYMOB_BASE_URL=https://uae.paymob.com/api

TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

If product images/media are stored in S3, Cloudflare R2, or MinIO-compatible
storage, also configure:

```env
MEDIA_BUCKET_NAME=...
MEDIA_ENDPOINT_URL=...
MEDIA_REGION=...
MEDIA_ACCESS_KEY=...
MEDIA_SECRET_KEY=...
MEDIA_CDN_BASE_URL=https://cdn.your-domain.com
MEDIA_OBJECT_ACL=public-read
```

The `OPENAI_*` and `TELEGRAM_AI_*` variables in the FLOR backend are only needed
if the old FLOR Telegram AI bot remains enabled. They are not required for the
website chat widget, because website AI is handled by Operon.

## 2. FLOR Frontend

Project path:
Production variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com

NEXT_PUBLIC_OPERON_WIDGET_URL=https://your-operon-widget-domain.com/embed.js
NEXT_PUBLIC_OPERON_API_BASE_URL=https://your-operon-api-domain.com/api

NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/flor_dubai
NEXT_PUBLIC_WHATSAPP_URL=https://wa.me/971...
NEXT_PUBLIC_CONTACT_EMAIL=hello@flor.com
```

Important:

```text
NEXT_PUBLIC_API_URL must point to the FLOR backend root URL, without /api.
```

Example:

```env
NEXT_PUBLIC_API_URL=https://api.flor-domain.com
NEXT_PUBLIC_OPERON_WIDGET_URL=https://assistant.flor-domain.com/embed.js
NEXT_PUBLIC_OPERON_API_BASE_URL=https://assistant-api.flor-domain.com/api
```

## 3. Operon

Project path:
Production variables:

```env
NODE_ENV=production
PORT=3004

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/OPERON_DB?schema=public
JWT_SECRET=long_random_secret

AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=45

CATALOG_PROVIDER=flor
FLOR_API_BASE_URL=https://your-backend-domain.com

CORS_ORIGINS=https://your-operon-widget-domain.com,https://your-frontend-domain.com

REVIEW_DELAY_MINUTES=7
```

If Operon and the FLOR backend are deployed in the same private network, prefer
an internal URL for `FLOR_API_BASE_URL`:

```env
FLOR_API_BASE_URL=http://flordubai-backend:8000
```

If Operon calls the FLOR backend through the public internet:

```env
FLOR_API_BASE_URL=https://api.flor-domain.com
```

Run Operon database migrations after deployment:

```bash
pnpm --filter @operon/api prisma:migrate:deploy
```

## Final Production Linkage

Frontend points to Operon:

```env
NEXT_PUBLIC_OPERON_WIDGET_URL=https://assistant.flor-domain.com/embed.js
NEXT_PUBLIC_OPERON_API_BASE_URL=https://assistant-api.flor-domain.com/api
```

Operon points to FLOR backend:

```env
CATALOG_PROVIDER=flor
FLOR_API_BASE_URL=https://api.flor-domain.com
CORS_ORIGINS=https://assistant.flor-domain.com,https://flor-domain.com
```

Request flow:

```text
Customer browser
  -> FLOR frontend
  -> Operon widget embed
  -> Operon API /api/chat/message
  -> FLOR backend /store/products, /api/delivery/slots, /store/orders
```
