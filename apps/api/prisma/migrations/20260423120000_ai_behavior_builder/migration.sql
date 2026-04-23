CREATE TYPE "agent_behavior_version_status" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "agent_behavior_profiles" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_behavior_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_behavior_versions" (
  "id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "agent_behavior_version_status" NOT NULL DEFAULT 'draft',
  "definition" JSONB NOT NULL,
  "compiled_prompt" TEXT NOT NULL,
  "created_by" TEXT,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_behavior_versions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversations"
ADD COLUMN "behavior_version_id" UUID;

ALTER TABLE "ai_action_logs"
ADD COLUMN "behavior_version_id" UUID;

CREATE UNIQUE INDEX "agent_behavior_profiles_code_key" ON "agent_behavior_profiles"("code");
CREATE UNIQUE INDEX "agent_behavior_versions_profile_id_version_key" ON "agent_behavior_versions"("profile_id", "version");
CREATE INDEX "agent_behavior_versions_profile_id_status_idx" ON "agent_behavior_versions"("profile_id", "status");
CREATE INDEX "conversations_behavior_version_id_idx" ON "conversations"("behavior_version_id");
CREATE INDEX "ai_action_logs_behavior_version_id_created_at_idx" ON "ai_action_logs"("behavior_version_id", "created_at");

ALTER TABLE "agent_behavior_versions"
ADD CONSTRAINT "agent_behavior_versions_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "agent_behavior_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_behavior_version_id_fkey"
FOREIGN KEY ("behavior_version_id") REFERENCES "agent_behavior_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_action_logs"
ADD CONSTRAINT "ai_action_logs_behavior_version_id_fkey"
FOREIGN KEY ("behavior_version_id") REFERENCES "agent_behavior_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
