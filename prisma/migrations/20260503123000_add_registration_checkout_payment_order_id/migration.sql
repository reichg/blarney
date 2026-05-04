ALTER TABLE "RegistrationCheckout" ADD COLUMN "paymentOrderId" TEXT;

CREATE UNIQUE INDEX "RegistrationCheckout_paymentOrderId_key" ON "RegistrationCheckout"("paymentOrderId");