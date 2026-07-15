CREATE UNIQUE INDEX "generated_messages_recipientId_active_true_key"
  ON "generated_messages"("recipientId")
  WHERE "active" = true;

CREATE UNIQUE INDEX "outreach_generation_jobs_outreachId_active_key"
  ON "outreach_generation_jobs"("outreachId")
  WHERE "status" IN ('PENDING', 'PROCESSING');

CREATE INDEX "outreach_recipients_outreachId_status_createdAt_idx"
  ON "outreach_recipients"("outreachId", "status", "createdAt");

CREATE INDEX "outreach_recipients_workspaceId_outreachId_status_idx"
  ON "outreach_recipients"("workspaceId", "outreachId", "status");
