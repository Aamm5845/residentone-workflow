-- AlterTable: Add source file columns to FloorplanApprovalVersion
ALTER TABLE "public"."FloorplanApprovalVersion" ADD COLUMN IF NOT EXISTS "sourceFilePath" TEXT;
ALTER TABLE "public"."FloorplanApprovalVersion" ADD COLUMN IF NOT EXISTS "sourceFileName" TEXT;

