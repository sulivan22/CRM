CREATE TABLE "workspace_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "companyName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "locale" TEXT NOT NULL DEFAULT 'en-US',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_ai_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'fake',
  "apiKey" TEXT,
  "model" TEXT NOT NULL DEFAULT 'fake-v1',
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "maxTokens" INTEGER NOT NULL DEFAULT 800,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_ai_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workspace_email_settings"
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "workspace_email_settings"
  ALTER COLUMN "provider" SET DEFAULT 'fake',
  ALTER COLUMN "fromName" SET DEFAULT 'AI Outreach OS',
  ALTER COLUMN "fromEmail" SET DEFAULT 'no-reply@example.test';

UPDATE "workspace_email_settings"
SET "provider" = lower("provider");

CREATE UNIQUE INDEX "workspace_settings_workspaceId_key" ON "workspace_settings"("workspaceId");
CREATE INDEX "workspace_settings_workspaceId_idx" ON "workspace_settings"("workspaceId");

CREATE UNIQUE INDEX "workspace_ai_settings_workspaceId_key" ON "workspace_ai_settings"("workspaceId");
CREATE INDEX "workspace_ai_settings_workspaceId_idx" ON "workspace_ai_settings"("workspaceId");

INSERT INTO "workspace_settings" ("workspaceId", "companyName", "updatedAt")
SELECT "id", "name", CURRENT_TIMESTAMP
FROM "workspaces"
ON CONFLICT ("workspaceId") DO NOTHING;

INSERT INTO "workspace_ai_settings" ("workspaceId", "updatedAt")
SELECT "id", CURRENT_TIMESTAMP
FROM "workspaces"
ON CONFLICT ("workspaceId") DO NOTHING;

INSERT INTO "workspace_email_settings" (
  "id",
  "workspaceId",
  "provider",
  "fromName",
  "fromEmail",
  "enabled",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  "id",
  'fake',
  "name",
  'no-reply@example.test',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "workspaces"
WHERE NOT EXISTS (
  SELECT 1
  FROM "workspace_email_settings"
  WHERE "workspace_email_settings"."workspaceId" = "workspaces"."id"
);

ALTER TABLE "workspace_settings"
  ADD CONSTRAINT "workspace_settings_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_ai_settings"
  ADD CONSTRAINT "workspace_ai_settings_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
