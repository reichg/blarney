-- AlterTable
ALTER TABLE "Participant" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "checkoutId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "Registration_paymentReference_key";

-- CreateIndex
CREATE INDEX "Registration_paymentReference_idx" ON "Registration"("paymentReference");

-- CreateIndex
CREATE INDEX "Registration_checkoutId_idx" ON "Registration"("checkoutId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "RegistrationCheckout"("id") ON DELETE SET NULL ON UPDATE CASCADE;