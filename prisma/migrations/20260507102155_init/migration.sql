-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('EXTERNAL_PENDING', 'CONFIRMED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PhotoPurpose" AS ENUM ('GALLERY', 'REMEMBRANCE');

-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RsvpSource" AS ENUM ('FORM', 'REGISTRATION');

-- CreateEnum
CREATE TYPE "RegistrationCheckoutStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAYMENT_REVIEW');

-- CreateEnum
CREATE TYPE "RsvpCheckoutStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAYMENT_REVIEW');

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "gender" "Gender" NOT NULL,
    "age" INTEGER NOT NULL,
    "averageScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "checkoutId" TEXT,
    "packageSelection" TEXT NOT NULL,
    "adultGuestCount" INTEGER NOT NULL DEFAULT 0,
    "childGuestCount" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'EXTERNAL_PENDING',
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationCheckout" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "paymentReference" TEXT,
    "paymentOrderId" TEXT,
    "paymentUrl" TEXT,
    "status" "RegistrationCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "registrationId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paymentCompletedAt" TIMESTAMP(3),
    "paymentReviewReason" TEXT,
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" TEXT NOT NULL,
    "participantId" TEXT,
    "source" "RsvpSource" NOT NULL DEFAULT 'FORM',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "adultAttendeeCount" INTEGER,
    "childAttendeeCount" INTEGER,
    "attendeeCount" INTEGER NOT NULL DEFAULT 1,
    "familyNames" TEXT,
    "dietaryNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "rating" INTEGER,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoSubmission" (
    "id" TEXT NOT NULL,
    "submitterName" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "caption" TEXT,
    "purpose" "PhotoPurpose" NOT NULL DEFAULT 'GALLERY',
    "feedbackId" TEXT,
    "s3Key" TEXT NOT NULL,
    "approvedS3Key" TEXT,
    "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teeTime" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,
    "status" "PairingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "snapshotScore" INTEGER NOT NULL,
    "snapshotAge" INTEGER NOT NULL,
    "snapshotGender" "Gender" NOT NULL,

    CONSTRAINT "PairingMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");

-- CreateIndex
CREATE INDEX "Participant_gender_averageScore_age_idx" ON "Participant"("gender", "averageScore", "age");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_participantId_key" ON "Registration"("participantId");

-- CreateIndex
CREATE INDEX "Registration_paymentStatus_idx" ON "Registration"("paymentStatus");

-- CreateIndex
CREATE INDEX "Registration_paymentReference_idx" ON "Registration"("paymentReference");

-- CreateIndex
CREATE INDEX "Registration_checkoutId_idx" ON "Registration"("checkoutId");

-- CreateIndex
CREATE INDEX "Registration_createdAt_idx" ON "Registration"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCheckout_idempotencyKey_key" ON "RegistrationCheckout"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCheckout_paymentReference_key" ON "RegistrationCheckout"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCheckout_paymentOrderId_key" ON "RegistrationCheckout"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCheckout_registrationId_key" ON "RegistrationCheckout"("registrationId");

-- CreateIndex
CREATE INDEX "RegistrationCheckout_email_idx" ON "RegistrationCheckout"("email");

-- CreateIndex
CREATE INDEX "RegistrationCheckout_status_createdAt_idx" ON "RegistrationCheckout"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_email_key" ON "Rsvp"("email");

-- CreateIndex
CREATE INDEX "Rsvp_createdAt_idx" ON "Rsvp"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_participantId_source_key" ON "Rsvp"("participantId", "source");

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

-- CreateIndex
CREATE INDEX "Feedback_category_idx" ON "Feedback"("category");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoSubmission_s3Key_key" ON "PhotoSubmission"("s3Key");

-- CreateIndex
CREATE INDEX "PhotoSubmission_status_createdAt_idx" ON "PhotoSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoSubmission_feedbackId_idx" ON "PhotoSubmission"("feedbackId");

-- CreateIndex
CREATE INDEX "PairingGroup_status_sortOrder_idx" ON "PairingGroup"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "PairingMember_participantId_idx" ON "PairingMember"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "PairingMember_groupId_slot_key" ON "PairingMember"("groupId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "EventSetting_key_key" ON "EventSetting"("key");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "RegistrationCheckout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCheckout" ADD CONSTRAINT "RegistrationCheckout_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpCheckout" ADD CONSTRAINT "RsvpCheckout_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSubmission" ADD CONSTRAINT "PhotoSubmission_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingMember" ADD CONSTRAINT "PairingMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PairingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingMember" ADD CONSTRAINT "PairingMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
