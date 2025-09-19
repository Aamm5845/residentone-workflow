-- Add createdById, updatedById to Room
ALTER TABLE "Room" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Room" ADD COLUMN "updatedById" TEXT;

-- Add createdById, updatedById, completedById to Stage
ALTER TABLE "Stage" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Stage" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Stage" ADD COLUMN "completedById" TEXT;

-- Add createdById, updatedById to DesignSection
ALTER TABLE "DesignSection" ADD COLUMN "createdById" TEXT;
ALTER TABLE "DesignSection" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "DesignSection" ADD COLUMN "completedById" TEXT;

-- Add createdById, updatedById to FFEItem
ALTER TABLE "FFEItem" ADD COLUMN "createdById" TEXT;
ALTER TABLE "FFEItem" ADD COLUMN "updatedById" TEXT;

-- Add updatedById to Project (it already has createdById)
ALTER TABLE "Project" ADD COLUMN "updatedById" TEXT;

-- Add mustChangePassword to User
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Create UserSession table for tracking active sessions
CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastSeen" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY ("id"),
  CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index on UserSession userId for faster lookups
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE UNIQUE INDEX "UserSession_userId_deviceId_idx" ON "UserSession"("userId", "deviceId");

-- Create ActivityLog table for comprehensive action tracking
CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "orgId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY ("id"),
  CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ActivityLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes on ActivityLog for faster lookups and filtering
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
CREATE INDEX "ActivityLog_orgId_idx" ON "ActivityLog"("orgId");
CREATE INDEX "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");