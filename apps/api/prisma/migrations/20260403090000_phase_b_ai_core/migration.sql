DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE "message_role" AS ENUM (
      'user',
      'assistant',
      'system',
      'tool',
      'operator'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'handoff_state') THEN
    CREATE TYPE "handoff_state" AS ENUM (
      'ai',
      'operator'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_action_status') THEN
    CREATE TYPE "ai_action_status" AS ENUM (
      'succeeded',
      'failed',
      'skipped'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_name" TEXT,
  "customer_phone" TEXT,
  "handoff_state" "handoff_state" NOT NULL DEFAULT 'ai',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" "message_role" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ai_action_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "action_type" TEXT NOT NULL,
  "tool_name" TEXT,
  "status" "ai_action_status" NOT NULL DEFAULT 'succeeded',
  "model" TEXT,
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_messages_conversation_id_created_at"
  ON "messages" ("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_ai_action_logs_conversation_id_created_at"
  ON "ai_action_logs" ("conversation_id", "created_at");
