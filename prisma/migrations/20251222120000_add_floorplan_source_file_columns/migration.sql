-- AlterTable: Add source file columns to FloorplanApprovalVersion
-- Using DO block to handle case where columns might already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FloorplanApprovalVersion' AND column_name='sourceFilePath') THEN
        ALTER TABLE "FloorplanApprovalVersion" ADD COLUMN "sourceFilePath" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FloorplanApprovalVersion' AND column_name='sourceFileName') THEN
        ALTER TABLE "FloorplanApprovalVersion" ADD COLUMN "sourceFileName" TEXT;
    END IF;
END $$;

