ALTER TYPE "RegistrationCheckoutStatus" ADD VALUE 'PAYMENT_REVIEW';

ALTER TABLE "RegistrationCheckout"
ADD COLUMN "paymentCompletedAt" TIMESTAMP(3),
ADD COLUMN "paymentReviewReason" TEXT,
ADD COLUMN "lastReconciledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "RegistrationCheckout_active_email_key"
ON "RegistrationCheckout"("email")
WHERE "status" <> 'CONFIRMED';