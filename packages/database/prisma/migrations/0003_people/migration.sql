CREATE TYPE "OrganizationType" AS ENUM ('COMPANY', 'AGENCY', 'CREATOR_NETWORK', 'NONPROFIT', 'OTHER');
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DO_NOT_CONTACT');
CREATE TYPE "PersonSource" AS ENUM ('MANUAL', 'IMPORT');
CREATE TYPE "CommunicationChannelType" AS ENUM ('EMAIL', 'LINKEDIN', 'X', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'WEBSITE', 'PHONE', 'OTHER');
CREATE TYPE "CommunicationChannelStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ImportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "organizations" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "type" "OrganizationType" NOT NULL DEFAULT 'COMPANY',
  "website" TEXT,
  "countryCode" TEXT,
  "description" TEXT,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "people" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "organizationId" UUID,
  "firstName" TEXT,
  "lastName" TEXT,
  "displayName" TEXT NOT NULL,
  "jobTitle" TEXT,
  "countryCode" TEXT,
  "languageCode" TEXT,
  "followerCount" INTEGER,
  "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "PersonSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication_channels" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "type" "CommunicationChannelType" NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "CommunicationChannelStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communication_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "person_tags" (
  "personId" UUID NOT NULL,
  "tagId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "person_tags_pkey" PRIMARY KEY ("personId", "tagId")
);

CREATE TABLE "import_jobs" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "originalFilename" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "succeededRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "mapping" JSONB NOT NULL,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_row_errors" (
  "id" UUID NOT NULL,
  "importJobId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "errorCode" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "rawRow" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_row_errors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_workspaceId_normalizedName_key" ON "organizations"("workspaceId", "normalizedName");
CREATE INDEX "organizations_workspaceId_status_idx" ON "organizations"("workspaceId", "status");
CREATE INDEX "organizations_workspaceId_type_idx" ON "organizations"("workspaceId", "type");
CREATE INDEX "organizations_workspaceId_countryCode_idx" ON "organizations"("workspaceId", "countryCode");

CREATE INDEX "people_workspaceId_status_idx" ON "people"("workspaceId", "status");
CREATE INDEX "people_workspaceId_organizationId_idx" ON "people"("workspaceId", "organizationId");
CREATE INDEX "people_workspaceId_countryCode_idx" ON "people"("workspaceId", "countryCode");
CREATE INDEX "people_workspaceId_languageCode_idx" ON "people"("workspaceId", "languageCode");
CREATE INDEX "people_workspaceId_followerCount_idx" ON "people"("workspaceId", "followerCount");

CREATE UNIQUE INDEX "communication_channels_personId_type_normalizedValue_key" ON "communication_channels"("personId", "type", "normalizedValue");
CREATE UNIQUE INDEX "communication_channels_workspaceId_type_normalizedValue_key" ON "communication_channels"("workspaceId", "type", "normalizedValue");
CREATE INDEX "communication_channels_workspaceId_status_idx" ON "communication_channels"("workspaceId", "status");
CREATE INDEX "communication_channels_personId_status_idx" ON "communication_channels"("personId", "status");

CREATE UNIQUE INDEX "tags_workspaceId_normalizedName_key" ON "tags"("workspaceId", "normalizedName");
CREATE INDEX "tags_workspaceId_idx" ON "tags"("workspaceId");
CREATE INDEX "person_tags_tagId_idx" ON "person_tags"("tagId");

CREATE INDEX "import_jobs_workspaceId_status_idx" ON "import_jobs"("workspaceId", "status");
CREATE INDEX "import_jobs_workspaceId_createdAt_idx" ON "import_jobs"("workspaceId", "createdAt");
CREATE INDEX "import_row_errors_importJobId_rowNumber_idx" ON "import_row_errors"("importJobId", "rowNumber");

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "people" ADD CONSTRAINT "people_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "people" ADD CONSTRAINT "people_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_row_errors" ADD CONSTRAINT "import_row_errors_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
