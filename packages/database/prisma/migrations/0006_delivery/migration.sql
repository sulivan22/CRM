CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

CREATE TABLE "workspace_email_settings" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'FAKE',
  "fromName" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "replyTo" TEXT,
  "apiKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_email_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deliveries" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "generatedMessageId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_email_settings_workspaceId_key"
  ON "workspace_email_settings"("workspaceId");

CREATE INDEX "workspace_email_settings_workspaceId_idx"
  ON "workspace_email_settings"("workspaceId");

CREATE UNIQUE INDEX "deliveries_generatedMessageId_key"
  ON "deliveries"("generatedMessageId");

CREATE INDEX "deliveries_workspaceId_status_idx"
  ON "deliveries"("workspaceId", "status");

CREATE INDEX "deliveries_workspaceId_createdAt_idx"
  ON "deliveries"("workspaceId", "createdAt");

ALTER TABLE "workspace_email_settings"
  ADD CONSTRAINT "workspace_email_settings_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_generatedMessageId_fkey"
  FOREIGN KEY ("generatedMessageId") REFERENCES "generated_messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
