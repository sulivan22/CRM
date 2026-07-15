CREATE TYPE "ConversationChannel" AS ENUM ('EMAIL');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "InboundWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "outreachId" UUID,
  "generatedMessageId" UUID,
  "deliveryId" UUID,
  "channel" "ConversationChannel" NOT NULL DEFAULT 'EMAIL',
  "subject" TEXT,
  "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  "lastMessageAt" TIMESTAMP(3) NOT NULL,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "providerThreadId" TEXT,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "replyToAddress" TEXT,
  "subject" TEXT,
  "textBody" TEXT,
  "htmlBody" TEXT,
  "headers" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  "rawMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "InboundWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inbound_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_workspaceId_status_lastMessageAt_idx" ON "conversations"("workspaceId", "status", "lastMessageAt");
CREATE INDEX "conversations_workspaceId_personId_idx" ON "conversations"("workspaceId", "personId");
CREATE INDEX "conversations_workspaceId_outreachId_idx" ON "conversations"("workspaceId", "outreachId");
CREATE INDEX "conversations_workspaceId_deliveryId_idx" ON "conversations"("workspaceId", "deliveryId");

CREATE UNIQUE INDEX "inbound_messages_provider_providerMessageId_key" ON "inbound_messages"("provider", "providerMessageId");
CREATE INDEX "inbound_messages_workspaceId_receivedAt_idx" ON "inbound_messages"("workspaceId", "receivedAt");
CREATE INDEX "inbound_messages_workspaceId_conversationId_receivedAt_idx" ON "inbound_messages"("workspaceId", "conversationId", "receivedAt");
CREATE INDEX "inbound_messages_provider_providerThreadId_idx" ON "inbound_messages"("provider", "providerThreadId");

CREATE UNIQUE INDEX "inbound_webhook_events_provider_providerEventId_key" ON "inbound_webhook_events"("provider", "providerEventId");
CREATE INDEX "inbound_webhook_events_status_createdAt_idx" ON "inbound_webhook_events"("status", "createdAt");
CREATE INDEX "inbound_webhook_events_workspaceId_createdAt_idx" ON "inbound_webhook_events"("workspaceId", "createdAt");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_generatedMessageId_fkey" FOREIGN KEY ("generatedMessageId") REFERENCES "generated_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inbound_messages"
  ADD CONSTRAINT "inbound_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inbound_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inbound_webhook_events"
  ADD CONSTRAINT "inbound_webhook_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
