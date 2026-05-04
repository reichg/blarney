import { db } from "@/lib/db";
import {
  completeRegistrationPaymentStatuses,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
  isCompleteRegistrationPaymentStatus,
} from "@/lib/payment";

type RegistrationPaymentRecord = {
  id: string;
  paymentStatus: string;
  paymentReference: string | null;
};

export type RegistrationPaymentReconciliation = RegistrationPaymentRecord & {
  existingPaymentUrl: string | null;
};

export async function reconcileRegistrationPayment(
  registration: RegistrationPaymentRecord,
): Promise<RegistrationPaymentReconciliation> {
  if (
    isCompleteRegistrationPaymentStatus(registration.paymentStatus) ||
    !hasSquarePaymentConfiguration() ||
    !registration.paymentReference
  ) {
    return {
      ...registration,
      existingPaymentUrl: null,
    };
  }

  const paymentLink = await getRegistrationPaymentLinkState(
    registration.paymentReference,
  );

  if (!paymentLink) {
    return {
      ...registration,
      existingPaymentUrl: null,
    };
  }

  if (paymentLink.isComplete) {
    await db.registration.updateMany({
      where: {
        id: registration.id,
        paymentStatus: {
          notIn: [...completeRegistrationPaymentStatuses],
        },
      },
      data: {
        paymentStatus: "CONFIRMED",
      },
    });

    return {
      ...registration,
      paymentStatus: "CONFIRMED",
      existingPaymentUrl: null,
    };
  }

  return {
    ...registration,
    existingPaymentUrl: paymentLink.url,
  };
}
