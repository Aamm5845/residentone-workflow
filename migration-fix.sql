-- Safe migration to update DESIGN to DESIGN_CONCEPT
-- Run this before applying the Prisma migration

BEGIN;

-- Step 1: Add the new enum value first
ALTER TYPE "StageType" ADD VALUE 'DESIGN_CONCEPT';

-- Step 2: Update existing records from DESIGN to DESIGN_CONCEPT  
UPDATE "Stage" SET type = 'DESIGN_CONCEPT' WHERE type = 'DESIGN';

-- Step 3: Update any default values or constraints that reference DESIGN
-- (This might be needed depending on your current database state)

COMMIT;

-- After this, you can run: npx prisma migrate dev
-- Prisma will then safely remove the old DESIGN value