/*
  Warnings:

  - A unique constraint covering the column `[participantId]` on the table `Registration` will be added. If duplicate participant registrations already exist, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Registration_participantId_key" ON "Registration"("participantId");