-- AlterTable: Add source file columns to FloorplanApprovalVersion
ALTER TABLE "FloorplanApprovalVersion" ADD COLUMN IF NOT EXISTS "sourceFilePath" TEXT;
ALTER TABLE "FloorplanApprovalVersion" ADD COLUMN IF NOT EXISTS "sourceFileName" TEXT;

