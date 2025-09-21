-- CreateEnum
CREATE TYPE "DrawingChecklistType" AS ENUM ('LIGHTING', 'ELEVATION', 'MILLWORK', 'FLOORPLAN', 'CUSTOM');

-- CreateTable
CREATE TABLE "DrawingChecklistItem" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" "DrawingChecklistType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DrawingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DrawingChecklistItem" ADD CONSTRAINT "DrawingChecklistItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "drawingChecklistItemId" TEXT;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_drawingChecklistItemId_fkey" FOREIGN KEY ("drawingChecklistItemId") REFERENCES "DrawingChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "DrawingChecklistItem_stageId_type_key" ON "DrawingChecklistItem"("stageId", "type");

-- CreateIndex
CREATE INDEX "DrawingChecklistItem_stageId_idx" ON "DrawingChecklistItem"("stageId");

-- CreateIndex
CREATE INDEX "DrawingChecklistItem_order_idx" ON "DrawingChecklistItem"("order");