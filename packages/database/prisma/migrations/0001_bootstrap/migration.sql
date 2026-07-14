CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "system_health" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "system_health_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_health_name_key" ON "system_health"("name");
