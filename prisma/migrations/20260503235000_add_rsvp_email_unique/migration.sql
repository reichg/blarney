/*
  Warnings:

  - A unique constraint covering the column `[email]` on the table `Rsvp` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_email_key" ON "Rsvp"("email");