-- AlterTable
ALTER TABLE "PhotoSubmission" ADD COLUMN     "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "PhotoSubmission_purpose_contentHash_idx" ON "PhotoSubmission"("purpose", "contentHash");
