import {
  buildChairRegistrationCsv,
  type ChairRegistrationExportRecord,
} from "@/lib/chairRegistrationExport";
import { describe, expect, it } from "vitest";

describe("buildChairRegistrationCsv", () => {
  const registrations: ChairRegistrationExportRecord[] = [
    {
      paymentStatus: "CONFIRMED",
      packageSelection: "Golf registration",
      adultGuestCount: 2,
      childGuestCount: 1,
      checkout: { email: "payer@example.com" },
      participant: {
        firstName: "Pat",
        lastName: "Golfer",
        email: "pat@example.com",
        phone: "555-0100",
        age: 42,
        gender: "FEMALE",
        averageScore: 41,
      },
    },
    {
      paymentStatus: "EXTERNAL_PENDING",
      packageSelection: "Junior golfer",
      adultGuestCount: 0,
      childGuestCount: 0,
      checkout: null,
      participant: {
        firstName: "Riley",
        lastName: "Comma, Quote",
        email: "riley@example.com",
        phone: null,
        age: 14,
        gender: "PREFER_NOT_TO_SAY",
        averageScore: 42,
      },
    },
  ];

  it("exports general registration columns and formatted values", () => {
    const csv = buildChairRegistrationCsv(registrations);

    expect(csv).toBe(
      [
        "Name,Email,Phone,Gender,Age,Score,Package,BBQ Only Adults,BBQ Only Kids,Paid",
        "Pat Golfer,payer@example.com,555-0100,FEMALE,42,41,Golf registration,2,1,Complete",
        '"Riley Comma, Quote",riley@example.com,,PREFER NOT TO SAY,14,42,Junior golfer,0,0,Pending payment',
      ].join("\n"),
    );
  });

  it("exports golfer registration columns and good golfer threshold", () => {
    const csv = buildChairRegistrationCsv(registrations, "golfers");

    expect(csv).toBe(
      [
        "Name,Email,Phone,Gender,Age,Score,Good Golfer (41 and below),Paid (status)",
        "Pat Golfer,payer@example.com,555-0100,FEMALE,42,41,Yes,Complete",
        '"Riley Comma, Quote",riley@example.com,,PREFER NOT TO SAY,14,42,No,Pending payment',
      ].join("\n"),
    );
  });
});
