-- Add completed column to DesignSection table if it doesn't exist
ALTER TABLE "public"."DesignSection" 
ADD COLUMN IF NOT EXISTS "completed" BOOLEAN DEFAULT false;