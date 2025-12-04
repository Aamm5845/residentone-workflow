-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "statusManuallySet" BOOLEAN NOT NULL DEFAULT false;

