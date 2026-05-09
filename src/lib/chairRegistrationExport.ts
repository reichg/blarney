import { arrayToCsv } from "@/lib/csv";
import type {
  ChairRegistrationExportRecord,
  ChairRegistrationExportScope,
  CsvField,
} from "@/lib/type";

const goodGolferScoreThreshold = 41;

export type {
  ChairRegistrationExportRecord,
  ChairRegistrationExportScope,
} from "@/lib/type";

export function formatRegistrationPaymentStatus(paymentStatus: string): string {
  if (paymentStatus === "EXTERNAL_PENDING") {
    return "Pending payment";
  }

  if (paymentStatus === "CONFIRMED") {
    return "Complete";
  }

  if (paymentStatus === "WAIVED") {
    return "Complete (waived)";
  }

  return paymentStatus.replaceAll("_", " ");
}

function formatEmail(registration: ChairRegistrationExportRecord): string {
  return registration.checkout?.email ?? registration.participant.email ?? "";
}

function formatName(registration: ChairRegistrationExportRecord): string {
  const { participant } = registration;

  return `${participant.firstName} ${participant.lastName}`.trim();
}

function formatGender(gender: string): string {
  return gender.replaceAll("_", " ");
}

function toGeneralRegistrationCsvRow(
  registration: ChairRegistrationExportRecord,
): CsvField[] {
  const { participant } = registration;

  return [
    formatName(registration),
    formatEmail(registration),
    participant.phone ?? "",
    participant.gender.replaceAll("_", " "),
    participant.age,
    participant.averageScore,
    registration.packageSelection,
    registration.adultGuestCount,
    registration.childGuestCount,
    formatRegistrationPaymentStatus(registration.paymentStatus),
  ];
}

function toGolfersRegistrationCsvRow(
  registration: ChairRegistrationExportRecord,
): CsvField[] {
  const { participant } = registration;

  return [
    formatName(registration),
    formatEmail(registration),
    participant.phone ?? "",
    formatGender(participant.gender),
    participant.age,
    participant.averageScore,
    participant.averageScore <= goodGolferScoreThreshold ? "Yes" : "No",
    formatRegistrationPaymentStatus(registration.paymentStatus),
  ];
}

export function buildChairRegistrationCsv(
  registrations: ChairRegistrationExportRecord[],
  scope: ChairRegistrationExportScope = "general",
): string {
  if (scope === "golfers") {
    return arrayToCsv([
      [
        "Name",
        "Email",
        "Phone",
        "Gender",
        "Age",
        "Score",
        "Good Golfer (41 and below)",
        "Paid (status)",
      ],
      ...registrations.map(toGolfersRegistrationCsvRow),
    ]);
  }

  return arrayToCsv([
    [
      "Name",
      "Email",
      "Phone",
      "Gender",
      "Age",
      "Score",
      "Package",
      "BBQ Only Adults",
      "BBQ Only Kids",
      "Paid",
    ],
    ...registrations.map(toGeneralRegistrationCsvRow),
  ]);
}
