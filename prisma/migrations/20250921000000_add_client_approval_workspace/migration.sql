-- CreateEnum for Client Approval Stage Status
CREATE TYPE "ClientApprovalStageStatus" AS ENUM ('DRAFT', 'PENDING_AARON_APPROVAL', 'READY_FOR_CLIENT', 'SENT_TO_CLIENT', 'CLIENT_REVIEWING', 'FOLLOW_UP_REQUIRED', 'CLIENT_APPROVED', 'REVISION_REQUESTED');

-- CreateTable for Client Approval Versions
CREATE TABLE "ClientApprovalVersion" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "ClientApprovalStageStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByAaron" BOOLEAN NOT NULL DEFAULT false,
    "aaronApprovedAt" TIMESTAMP(3),
    "aaronApprovedById" TEXT,
    "sentToClientAt" TIMESTAMP(3),
    "sentById" TEXT,
    "emailOpenedAt" TIMESTAMP(3),
    "followUpCompletedAt" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "clientDecision" "ApprovalStatus" DEFAULT 'PENDING',
    "clientDecidedAt" TIMESTAMP(3),
    "clientMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientApprovalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable for Client Approval Assets
CREATE TABLE "ClientApprovalAsset" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "includeInEmail" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientApprovalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable for Client Approval Email Logs
CREATE TABLE "ClientApprovalEmailLog" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "trackingPixelId" TEXT NOT NULL,

    CONSTRAINT "ClientApprovalEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable for Client Approval Activity Logs
CREATE TABLE "ClientApprovalActivity" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientApprovalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientApprovalAsset_versionId_assetId_key" ON "ClientApprovalAsset"("versionId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientApprovalEmailLog_trackingPixelId_key" ON "ClientApprovalEmailLog"("trackingPixelId");

-- AddForeignKey
ALTER TABLE "ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_aaronApprovedById_fkey" FOREIGN KEY ("aaronApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalVersion" ADD CONSTRAINT "ClientApprovalVersion_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalAsset" ADD CONSTRAINT "ClientApprovalAsset_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalAsset" ADD CONSTRAINT "ClientApprovalAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalEmailLog" ADD CONSTRAINT "ClientApprovalEmailLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalActivity" ADD CONSTRAINT "ClientApprovalActivity_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ClientApprovalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApprovalActivity" ADD CONSTRAINT "ClientApprovalActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;