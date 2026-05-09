import type { SearchParamsRecord } from "@/lib/type";

export type CheckoutStatusResponse =
  | {
      ok: true;
      status: "confirmed";
      thanksPath: string;
    }
  | {
      ok: true;
      status: "retry";
      paymentPath: string;
    }
  | {
      ok: true;
      status: "processing";
      paymentPath: string;
    }
  | {
      ok: true;
      status: "review" | "unavailable";
    }
  | {
      ok: false;
      status: "invalid" | "not_found";
    };

export type RegistrationConfirmationPollerProps = {
  checkoutId: string;
  confirmedMessage?: string;
  missingMessage?: string;
  processingMessage?: string;
  reviewMessage?: string;
  retryLabel?: string;
  retryMessage?: string;
  statusPath?: string;
  timeoutMessage?: string;
  unavailableMessage?: string;
};

export type RegisterThanksPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export type RegistrationStatusCard = {
  eyebrow: string;
  title: string;
  body: string;
  nextSteps: string[];
  note?: string;
  actionLabel?: string;
};
