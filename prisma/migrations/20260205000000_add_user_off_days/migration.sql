-- CreateEnum
CREATE TYPE "OffDayType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'HOLIDAY', 'OTHER');

-- CreateTable
CREATE TABLE "UserOffDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" "OffDayType" NOT NULL DEFAULT 'VACATION',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOffDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserOffDay_userId_idx" ON "UserOffDay"("userId");

-- CreateIndex
CREATE INDEX "UserOffDay_userId_date_idx" ON "UserOffDay"("userId", "date");

-- CreateIndex
CREATE INDEX "UserOffDay_date_idx" ON "UserOffDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserOffDay_userId_date_key" ON "UserOffDay"("userId", "date");

-- AddForeignKey
ALTER TABLE "UserOffDay" ADD CONSTRAINT "UserOffDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
