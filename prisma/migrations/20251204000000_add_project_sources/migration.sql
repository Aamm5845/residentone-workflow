-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('EXISTING_MEASUREMENTS', 'ARCHITECT_PLANS', 'REFERENCE_IMAGES', 'CLIENT_NOTES', 'PROPOSALS', 'CONTRACTS', 'COMMUNICATION', 'OTHER');

-- CreateTable
CREATE TABLE "ProjectSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" "SourceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dropboxPath" TEXT,
    "dropboxUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSource_projectId_idx" ON "ProjectSource"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSource_category_idx" ON "ProjectSource"("category");

-- CreateIndex
CREATE INDEX "ProjectSource_projectId_category_idx" ON "ProjectSource"("projectId", "category");

-- AddForeignKey
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

