/*
  Warnings:

  - A unique constraint covering the columns `[participantId,source]` on the table `Rsvp` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_participantId_source_key" ON "Rsvp"("participantId", "source");
