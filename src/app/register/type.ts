import type {
  SubmitRegistrationResult,
  SubmitRsvpResult,
} from "@/app/actions/type";

export type RegistrationFormProps = {
  currency: string;
  defaultPackageSelection: string;
  golfPriceCents: number | null;
  golfPriceLabel: string | null;
  adultGuestPriceCents: number | null;
  adultGuestPriceLabel: string | null;
  childGuestPriceCents: number | null;
  childGuestPriceLabel: string | null;
  submitRegistrationAction: (
    formData: FormData,
  ) => Promise<SubmitRegistrationResult>;
  submitRsvpAction: (formData: FormData) => Promise<SubmitRsvpResult>;
};

export type SummaryItem = {
  label: string;
  quantity: number;
  unitPriceLabel: string;
};

export type PendingCheckoutResume = {
  kind: "registration" | "rsvp";
  checkoutId: string;
  paymentPath: string;
  thanksPath: string;
};

export type SignupMode = "golf" | "bbq";

export type Golfer = {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  age: string;
  averageScore: string;
};

export type GolferField = Exclude<keyof Golfer, "id">;
