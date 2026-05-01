CREATE TABLE IF NOT EXISTS "couriers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "display_name" TEXT NOT NULL,
  "phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "api_token_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "delivery_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL UNIQUE,
  "courier_id" UUID NOT NULL,
  "proof_photo_data" TEXT,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "delivered_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "delivery_jobs_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "delivery_jobs_courier_id_fkey"
    FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "delivery_jobs_courier_id_idx" ON "delivery_jobs" ("courier_id");
