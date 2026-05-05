-- CreateEnum
CREATE TYPE "PhotoPurpose" AS ENUM ('GALLERY', 'REMEMBRANCE');

-- AlterTable
ALTER TABLE "PhotoSubmission" ADD COLUMN     "feedbackId" TEXT,
ADD COLUMN     "purpose" "PhotoPurpose" NOT NULL DEFAULT 'GALLERY';

-- CreateIndex
CREATE INDEX "PhotoSubmission_feedbackId_idx" ON "PhotoSubmission"("feedbackId");

-- AddForeignKey
ALTER TABLE "PhotoSubmission" ADD CONSTRAINT "PhotoSubmission_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;
