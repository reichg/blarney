import { afterEach, describe, expect, it, vi } from "vitest";

const {
  updateMany,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
} = vi.hoisted(() => ({
  updateMany: vi.fn(),
  getRegistrationPaymentLinkState: vi.fn(),
  hasSquarePaymentConfiguration: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      updateMany,
    },
  },
}));

vi.mock("@/lib/payment", () => ({
  completeRegistrationPaymentStatuses: ["CONFIRMED", "WAIVED"],
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
  isCompleteRegistrationPaymentStatus: (status: string) =>
    status === "CONFIRMED" || status === "WAIVED",
}));

import { reconcileRegistrationPayment } from "@/lib/registrationPayment";

afterEach(() => {
  vi.clearAllMocks();
});

describe("reconcileRegistrationPayment", () => {
  it("reuses the stored Square payment URL while payment is still pending", async () => {
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "OPEN",
      isComplete: false,
    });

    await expect(
      reconcileRegistrationPayment({
        id: "registration-123",
        paymentStatus: "EXTERNAL_PENDING",
        paymentReference: "payment-link-1",
      }),
    ).resolves.toEqual({
      id: "registration-123",
      paymentStatus: "EXTERNAL_PENDING",
      paymentReference: "payment-link-1",
      existingPaymentUrl: "https://square.link/u/existing",
    });

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marks the registration confirmed when Square shows the order completed", async () => {
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    updateMany.mockResolvedValue({ count: 1 });

    await expect(
      reconcileRegistrationPayment({
        id: "registration-123",
        paymentStatus: "EXTERNAL_PENDING",
        paymentReference: "payment-link-1",
      }),
    ).resolves.toEqual({
      id: "registration-123",
      paymentStatus: "CONFIRMED",
      paymentReference: "payment-link-1",
      existingPaymentUrl: null,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "registration-123",
        paymentStatus: {
          notIn: ["CONFIRMED", "WAIVED"],
        },
      },
      data: {
        paymentStatus: "CONFIRMED",
      },
    });
  });

  it("treats missing stored Square links as unusable without changing local status", async () => {
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue(null);

    await expect(
      reconcileRegistrationPayment({
        id: "registration-123",
        paymentStatus: "EXTERNAL_PENDING",
        paymentReference: "payment-link-1",
      }),
    ).resolves.toEqual({
      id: "registration-123",
      paymentStatus: "EXTERNAL_PENDING",
      paymentReference: "payment-link-1",
      existingPaymentUrl: null,
    });

    expect(updateMany).not.toHaveBeenCalled();
  });
});
