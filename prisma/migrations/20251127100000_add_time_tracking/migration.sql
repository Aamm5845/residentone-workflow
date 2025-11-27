-- CreateEnum
CREATE TYPE "public"."TimeEntryStatus" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED');

-- CreateTable
CREATE TABLE "public"."TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "roomId" TEXT,
    "stageId" TEXT,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "status" "public"."TimeEntryStatus" NOT NULL DEFAULT 'RUNNING',
    "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimePause" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL,
    "resumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimePause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimeEntryEdit" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntryEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserTimeSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "workStartTime" TEXT NOT NULL DEFAULT '09:00',
    "workEndTime" TEXT NOT NULL DEFAULT '17:00',
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderTime" TEXT NOT NULL DEFAULT '17:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTimeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "public"."TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_idx" ON "public"."TimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimeEntry_startTime_idx" ON "public"."TimeEntry"("startTime");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_status_idx" ON "public"."TimeEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_startTime_idx" ON "public"."TimeEntry"("userId", "startTime");

-- CreateIndex
CREATE INDEX "TimePause_timeEntryId_idx" ON "public"."TimePause"("timeEntryId");

-- CreateIndex
CREATE INDEX "TimeEntryEdit_timeEntryId_idx" ON "public"."TimeEntryEdit"("timeEntryId");

-- CreateIndex
CREATE INDEX "TimeEntryEdit_editedById_idx" ON "public"."TimeEntryEdit"("editedById");

-- CreateIndex
CREATE UNIQUE INDEX "UserTimeSettings_userId_key" ON "public"."UserTimeSettings"("userId");

-- CreateIndex
CREATE INDEX "UserTimeSettings_userId_idx" ON "public"."UserTimeSettings"("userId");

-- AddForeignKey
ALTER TABLE "public"."TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntry" ADD CONSTRAINT "TimeEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntry" ADD CONSTRAINT "TimeEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimePause" ADD CONSTRAINT "TimePause_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "public"."TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntryEdit" ADD CONSTRAINT "TimeEntryEdit_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "public"."TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntryEdit" ADD CONSTRAINT "TimeEntryEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserTimeSettings" ADD CONSTRAINT "UserTimeSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
