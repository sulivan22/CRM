CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY_FOR_REVIEW', 'APPROVED', 'ARCHIVED', 'FAILED');
CREATE TYPE "OutreachRecipientStatus" AS ENUM ('PENDING', 'GENERATED', 'APPROVED', 'EXCLUDED', 'FAILED');
CREATE TYPE "GeneratedMessageStatus" AS ENUM ('GENERATED', 'EDITED', 'APPROVED', 'REJECTED', 'FAILED');
CREATE TYPE "OutreachGenerationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

CREATE TABLE "outreach" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "languageCode" TEXT NOT NULL,
  "tone" TEXT NOT NULL,
  "length" TEXT NOT NULL,
  "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
  "audienceDefinition" JSONB NOT NULL,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "generatedRecipients" INTEGER NOT NULL DEFAULT 0,
  "approvedRecipients" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outreach_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_recipients" (
  "id" UUID NOT NULL,
  "outreachId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "status" "OutreachRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "contextSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outreach_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_instructions" (
  "id" UUID NOT NULL,
  "outreachId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "objective" TEXT NOT NULL,
  "languageCode" TEXT NOT NULL,
  "tone" TEXT NOT NULL,
  "length" TEXT NOT NULL,
  "additionalContext" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outreach_instructions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "generated_messages" (
  "id" UUID NOT NULL,
  "outreachId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "cta" TEXT,
  "status" "GeneratedMessageStatus" NOT NULL DEFAULT 'GENERATED',
  "generationVersion" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptSnapshot" JSONB,
  "outputMetadata" JSONB,
  "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "generated_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_generation_jobs" (
  "id" UUID NOT NULL,
  "outreachId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "status" "OutreachGenerationJobStatus" NOT NULL DEFAULT 'PENDING',
  "total" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outreach_generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outreach_workspaceId_status_idx" ON "outreach"("workspaceId", "status");
CREATE INDEX "outreach_workspaceId_createdAt_idx" ON "outreach"("workspaceId", "createdAt");
CREATE INDEX "outreach_workspaceId_createdByUserId_idx" ON "outreach"("workspaceId", "createdByUserId");

CREATE UNIQUE INDEX "outreach_recipients_outreachId_personId_key" ON "outreach_recipients"("outreachId", "personId");
CREATE INDEX "outreach_recipients_workspaceId_status_idx" ON "outreach_recipients"("workspaceId", "status");
CREATE INDEX "outreach_recipients_personId_idx" ON "outreach_recipients"("personId");

CREATE UNIQUE INDEX "outreach_instructions_outreachId_key" ON "outreach_instructions"("outreachId");
CREATE INDEX "outreach_instructions_workspaceId_idx" ON "outreach_instructions"("workspaceId");

CREATE UNIQUE INDEX "generated_messages_recipientId_generationVersion_key" ON "generated_messages"("recipientId", "generationVersion");
CREATE INDEX "generated_messages_workspaceId_status_idx" ON "generated_messages"("workspaceId", "status");
CREATE INDEX "generated_messages_outreachId_active_idx" ON "generated_messages"("outreachId", "active");
CREATE INDEX "generated_messages_recipientId_active_idx" ON "generated_messages"("recipientId", "active");

CREATE INDEX "outreach_generation_jobs_workspaceId_status_idx" ON "outreach_generation_jobs"("workspaceId", "status");
CREATE INDEX "outreach_generation_jobs_outreachId_createdAt_idx" ON "outreach_generation_jobs"("outreachId", "createdAt");

ALTER TABLE "outreach" ADD CONSTRAINT "outreach_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_instructions" ADD CONSTRAINT "outreach_instructions_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_instructions" ADD CONSTRAINT "outreach_instructions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_messages" ADD CONSTRAINT "generated_messages_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_messages" ADD CONSTRAINT "generated_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "outreach_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_messages" ADD CONSTRAINT "generated_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_generation_jobs" ADD CONSTRAINT "outreach_generation_jobs_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_generation_jobs" ADD CONSTRAINT "outreach_generation_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
