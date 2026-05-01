-- CreateEnum
CREATE TYPE "review_request_status" AS ENUM ('scheduled', 'sent', 'skipped_no_conversation', 'failed');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "conversation_id" UUID;

-- CreateTable
CREATE TABLE "review_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "conversation_id" UUID,
    "status" "review_request_status" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_order_id_key" ON "review_requests"("order_id");

-- CreateIndex
CREATE INDEX "review_requests_status_scheduled_at_idx" ON "review_requests"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "orders_conversation_id_idx" ON "orders"("conversation_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
