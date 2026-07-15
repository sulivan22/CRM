CREATE TYPE "AIExecutionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "AIInsightType" AS ENUM ('REPLY_SUMMARY', 'FACT_EXTRACTION', 'INTENT_CLASSIFICATION', 'NEXT_ACTION', 'GENERATED_TEXT');

CREATE TABLE "ai_executions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "actorUserId" UUID,
  "operation" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "AIExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "input" JSONB NOT NULL,
  "output" JSONB,
  "errorMessage" TEXT,
  "promptVersion" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_insights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "executionId" UUID NOT NULL,
  "personId" UUID,
  "conversationId" UUID,
  "type" "AIInsightType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_executions_workspaceId_operation_createdAt_idx" ON "ai_executions"("workspaceId", "operation", "createdAt");
CREATE INDEX "ai_executions_workspaceId_status_createdAt_idx" ON "ai_executions"("workspaceId", "status", "createdAt");
CREATE INDEX "ai_insights_workspaceId_type_createdAt_idx" ON "ai_insights"("workspaceId", "type", "createdAt");
CREATE INDEX "ai_insights_workspaceId_personId_createdAt_idx" ON "ai_insights"("workspaceId", "personId", "createdAt");
CREATE INDEX "ai_insights_workspaceId_conversationId_createdAt_idx" ON "ai_insights"("workspaceId", "conversationId", "createdAt");

ALTER TABLE "ai_executions"
  ADD CONSTRAINT "ai_executions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_executions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_insights"
  ADD CONSTRAINT "ai_insights_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_insights_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_insights_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_insights_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
