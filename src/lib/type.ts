import type {
  Gender,
  PhotoPurpose,
  Prisma,
  RegistrationCheckoutStatus,
  RsvpCheckoutStatus,
  RsvpSource,
} from "@prisma/client";
import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value ?? undefined;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

const requiredTextSchema = z.preprocess(
  normalizeRequiredFormValue,
  z.string().trim().min(1),
);

const optionalNullableTextSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().optional().nullable(),
  )
  .transform((value) => (value && value.length > 0 ? value : null));

const requiredIntSchema = (minimum: number, maximum: number) =>
  z.preprocess(
    normalizeRequiredFormValue,
    z.coerce.number().int().min(minimum).max(maximum),
  );

export type PageSizeOption = 10 | 20 | 30 | 40 | 50;

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export type PaginationKeyOptions = {
  pageKey?: string;
  pageSizeKey?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
};

export type PaginationParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  pageKey: string;
  pageSizeKey: string;
};

export type PaginationState = PaginationParams & {
  totalCount: number;
  totalPages: number;
  currentCount: number;
  startIndex: number;
  endIndex: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isEmpty: boolean;
};

export const registrationPackageOptions = ["Golf registration"] as const;

export type RegistrationPackageSelection =
  (typeof registrationPackageOptions)[number];

export const defaultRegistrationPackageSelection =
  registrationPackageOptions[0];

export const feedbackCategoryOptions = [
  "Registration",
  "Logistics",
  "Pairings",
  "Photos",
  "Other",
] as const;

export type FeedbackCategory = (typeof feedbackCategoryOptions)[number];

export const feedbackRatingOptions = [5, 4, 3, 2, 1] as const;

export const feedbackSubmissionSchema = z.object({
  name: requiredTextSchema,
  email: z.preprocess(normalizeRequiredFormValue, z.string().trim().email()),
  rating: requiredIntSchema(1, 5),
  category: z.preprocess(
    normalizeRequiredFormValue,
    z.enum(feedbackCategoryOptions),
  ),
  message: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(3)),
});

export const REMEMBRANCE_FEEDBACK_CATEGORY = "In Remembrance";

export const remembranceSubmissionSchema = z.object({
  message: z.preprocess(
    normalizeOptionalString,
    z.string().trim().min(1, "Remembrance text is required."),
  ),
  name: z.preprocess(normalizeOptionalString, z.string().trim().min(1)),
  email: z.preprocess(normalizeOptionalString, z.string().trim().email()),
});

export type PairingApplicant = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  age: number;
  averageScore: number;
};

export type PairingGroupResult = {
  name: string;
  sortOrder: number;
  members: Array<{
    applicant: PairingApplicant;
    slot: number;
    isGoodGolfer: boolean;
  }>;
};

export type PairingDistributionGroup = {
  sortOrder: number;
  members: PairingApplicant[];
  femaleCount: number;
  goodCount: number;
  badCount: number;
};

export type SortablePairingGolfer = Pick<
  PairingApplicant,
  "id" | "firstName" | "lastName" | "gender" | "age" | "averageScore"
>;

type ChairRsvpRegistrationCounts = {
  adultGuestCount: number;
  childGuestCount: number;
};

export type ChairRsvpPartyCountsInput = {
  source: RsvpSource;
  adultAttendeeCount: number | null;
  childAttendeeCount: number | null;
  attendeeCount: number;
  participant: {
    age: number;
    registrations: ChairRsvpRegistrationCounts[];
  } | null;
};

export type ChairRsvpPartyCounts = {
  adultAttendeeCount: number;
  childAttendeeCount: number;
  attendeeCount: number;
};

export type ChairRegistrationExportRecord = {
  paymentStatus: string;
  packageSelection: string;
  adultGuestCount: number;
  childGuestCount: number;
  checkout: {
    email: string | null;
  } | null;
  participant: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    age: number;
    gender: string;
    averageScore: number;
  };
};

export type ChairRegistrationExportScope = "general" | "golfers";

export type RegistrationGuestCounts = {
  golferCount?: number;
  bbqOnlyAdultCount?: number;
  bbqOnlyKidCount?: number;
  adultGuestCount?: number;
  childGuestCount?: number;
};

export type RsvpAttendeeCounts = {
  adultAttendeeCount: number;
  childAttendeeCount: number;
};

export type RegistrationPaymentLineItem = {
  label: string;
  quantity: number;
  unitPriceCents: number;
  unitPriceLabel: string;
  totalCents: number;
  totalLabel: string;
};

export type RegistrationPaymentBreakdown = {
  currency: string;
  golferCount: number;
  golfPriceCents: number;
  golfPriceLabel: string;
  bbqOnlyAdultCount: number;
  bbqOnlyKidCount: number;
  adultGuestCount: number;
  adultGuestPriceCents: number;
  adultGuestPriceLabel: string;
  childGuestCount: number;
  childGuestPriceCents: number;
  childGuestPriceLabel: string;
  totalCents: number;
  totalLabel: string;
  lineItems: RegistrationPaymentLineItem[];
};

export type RsvpPaymentBreakdown = {
  currency: string;
  adultAttendeeCount: number;
  adultGuestPriceCents: number;
  adultGuestPriceLabel: string;
  childAttendeeCount: number;
  childGuestPriceCents: number;
  childGuestPriceLabel: string;
  totalCents: number;
  totalLabel: string;
  lineItems: RegistrationPaymentLineItem[];
};

export type RegistrationPaymentLinkState = {
  reference: string;
  orderId: string | null;
  url: string | null;
  orderState: string | null;
  isComplete: boolean;
};

export type SquarePaymentLinkResponse = {
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
};

export type SquareOrder = {
  id?: string;
  state?: string;
  tenders?: Array<{
    id?: string;
    payment_id?: string;
  }>;
  net_amount_due_money?: {
    amount?: number;
    currency?: string;
  };
};

export type SquarePaymentLinkDetailsResponse = SquarePaymentLinkResponse & {
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
  related_resources?: {
    orders?: SquareOrder[];
  };
};

export type SquareOrderResponse = {
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
  order?: SquareOrder;
};

export type SquareOrderLineItem = {
  name: string;
  quantity: string;
  base_price_money: {
    amount: number;
    currency: string;
  };
};

const golferSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  gender: z.enum(["MALE", "FEMALE"]),
  age: z.coerce.number().int().min(1).max(110),
  averageScore: z.coerce.number().int().min(20).max(120),
});

export const registrationCheckoutPayloadSchema = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    phone: requiredTextSchema,
    packageSelection: z.string().trim().min(1),
    golfers: z.array(golferSchema).min(1).max(20),
    bbqOnlyAdultCount: z.coerce.number().int().min(0).max(30),
    bbqOnlyKidCount: z.coerce.number().int().min(0).max(30),
    notes: optionalNullableTextSchema,
    dietaryNotes: optionalNullableTextSchema,
  })
  .refine((data) => data.bbqOnlyAdultCount + data.bbqOnlyKidCount <= 30, {
    message: "Keep additional BBQ-only guests at 30 or fewer.",
    path: ["bbqOnlyAdultCount"],
  });

export type RegistrationCheckoutPayload = z.infer<
  typeof registrationCheckoutPayloadSchema
>;

export type RegistrationCheckoutRecord = {
  id: string;
  idempotencyKey: string;
  email: string;
  payload: unknown;
  paymentReference: string | null;
  paymentOrderId: string | null;
  paymentUrl: string | null;
  status: RegistrationCheckoutStatus;
  registrationId: string | null;
  confirmedAt: Date | null;
  paymentCompletedAt: Date | null;
  paymentReviewReason: string | null;
  lastReconciledAt: Date | null;
  updatedAt: Date;
};

export type RegistrationCheckoutPaymentResult =
  | {
      ok: true;
      status: "pending";
      checkoutId: string;
      paymentReference: string;
      paymentUrl: string;
    }
  | {
      ok: true;
      status: "confirmed";
      checkoutId: string;
      registrationId: string;
      paymentUrl: null;
    }
  | {
      ok: false;
      reason:
        | "configuration"
        | "duplicate"
        | "not_found"
        | "review"
        | "unavailable";
    };

export type RegistrationCheckoutConfirmationResult =
  | {
      ok: true;
      registrationId: string;
    }
  | {
      ok: false;
      reason:
        | "duplicate"
        | "invalid"
        | "pending"
        | "review"
        | "retry"
        | "unavailable";
      paymentUrl?: string | null;
    };

export const rsvpCheckoutPayloadSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    adultAttendeeCount: z.coerce.number().int().min(0).max(30),
    childAttendeeCount: z.coerce.number().int().min(0).max(30),
    familyNames: optionalNullableTextSchema,
    dietaryNotes: optionalNullableTextSchema,
    notes: optionalNullableTextSchema,
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount <= 30, {
    message: "Keep the party size at 30 attendees or fewer.",
    path: ["adultAttendeeCount"],
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount > 0, {
    message: "Add at least one attendee to RSVP.",
    path: ["adultAttendeeCount"],
  });

export type RsvpCheckoutPayload = z.infer<typeof rsvpCheckoutPayloadSchema>;

export type RsvpCheckoutRecord = {
  id: string;
  idempotencyKey: string;
  email: string;
  payload: unknown;
  paymentReference: string | null;
  paymentOrderId: string | null;
  paymentUrl: string | null;
  status: RsvpCheckoutStatus;
  rsvpId: string | null;
  confirmedAt: Date | null;
  paymentCompletedAt: Date | null;
  paymentReviewReason: string | null;
  lastReconciledAt: Date | null;
  updatedAt: Date;
};

export type RsvpCheckoutPaymentResult =
  | {
      ok: true;
      status: "pending";
      checkoutId: string;
      paymentReference: string;
      paymentUrl: string;
    }
  | {
      ok: true;
      status: "confirmed";
      checkoutId: string;
      rsvpId: string;
      paymentUrl: null;
    }
  | {
      ok: false;
      reason:
        | "configuration"
        | "duplicate"
        | "not_found"
        | "review"
        | "unavailable";
    };

export type RsvpCheckoutConfirmationResult =
  | {
      ok: true;
      rsvpId: string;
    }
  | {
      ok: false;
      reason:
        | "duplicate"
        | "invalid"
        | "pending"
        | "review"
        | "retry"
        | "unavailable";
      paymentUrl?: string | null;
    };

export type CheckoutLogLevel = "info" | "warn" | "error";

export type RegistrationPaymentRecord = {
  id: string;
  paymentStatus: string;
  paymentReference: string | null;
};

export type RegistrationPaymentReconciliation = RegistrationPaymentRecord & {
  existingPaymentUrl: string | null;
};

export type PhotoUploadRequest = {
  caption?: string;
  contentType: string;
  feedbackId?: string;
  fileName: string;
  fileSize: number;
  purpose?: "GALLERY" | "REMEMBRANCE";
  submitterEmail: string;
  submitterName: string;
};

export type CsvField = string | number | boolean | null | undefined;

export type EventSettings = {
  eventTitle: string;
  eventDates: string;
  eventTime: string;
  eventLocation: string;
  courseName: string;
  dayBeforeEventName: string;
  registrationPackage: string;
  registrationPriceLabel: string;
  logisticsSummary: string;
  remembranceUrl: string;
  chairContact: string;
};

export const chairPhotoReviewInclude = {
  feedback: {
    select: {
      id: true,
      message: true,
    },
  },
} as const;

export const chairPhotoListOrderBy = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.PhotoSubmissionOrderByWithRelationInput[];

export const chairRemembranceDownloadSelect = {
  id: true,
  caption: true,
  s3Key: true,
  approvedS3Key: true,
  createdAt: true,
} as const;

export type ChairPhotoRecord = Prisma.PhotoSubmissionGetPayload<{
  include: typeof chairPhotoReviewInclude;
}>;

export type PaginatedChairPhotoResult = {
  photos: ChairPhotoRecord[];
  pagination: PaginationState;
};

export type ChairPhotoListPageOptions = {
  pagination: PaginationParams;
  purpose: PhotoPurpose;
  where?: Prisma.PhotoSubmissionWhereInput;
};

export type ChairRemembranceDownloadPhoto = {
  id: string;
  caption: string | null;
  s3Key: string;
  approvedS3Key: string | null;
  createdAt: Date;
};
