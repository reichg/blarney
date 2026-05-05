-- CreateEnum
CREATE TYPE "RsvpCheckoutStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAYMENT_REVIEW');

-- CreateTable
CREATE TABLE "RsvpCheckout" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "paymentReference" TEXT,
    "paymentOrderId" TEXT,
    "paymentUrl" TEXT,
    "status" "RsvpCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "rsvpId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paymentCompletedAt" TIMESTAMP(3),
    "paymentReviewReason" TEXT,
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RsvpCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RsvpCheckout_idempotencyKey_key" ON "RsvpCheckout"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpCheckout_paymentReference_key" ON "RsvpCheckout"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpCheckout_paymentOrderId_key" ON "RsvpCheckout"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpCheckout_rsvpId_key" ON "RsvpCheckout"("rsvpId");

-- CreateIndex
CREATE INDEX "RsvpCheckout_email_idx" ON "RsvpCheckout"("email");

-- CreateIndex
CREATE INDEX "RsvpCheckout_status_createdAt_idx" ON "RsvpCheckout"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RsvpCheckout" ADD CONSTRAINT "RsvpCheckout_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
