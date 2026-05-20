import {
  buildMarketplaceCheckoutDraftInputSchema,
  marketplaceCheckoutCustomerSchema,
  marketplaceCheckoutDraftSchema,
  marketplaceCheckoutItemRecordSchema,
  marketplaceCheckoutItemSnapshotSchema,
  marketplaceCheckoutPaymentAttemptRecordSchema,
  marketplaceCheckoutRecordSchema,
  marketplaceCheckoutRequestItemSchema,
  marketplaceCheckoutRequestSchema,
  marketplaceCheckoutStatusSchema,
  marketplaceCheckoutTotalsSchema,
  marketplaceFulfillmentStatusSchema,
  marketplaceJsonObjectSchema,
  marketplaceOrderItemRecordSchema,
  marketplaceOrderRecordSchema,
  marketplacePaymentAttemptStatusSchema,
  marketplacePaymentProviderSchema,
  marketplacePricedCheckoutItemSchema,
  marketplacePublicTokenSchema,
} from "@/lib/marketplaceCheckout.schema";
import type { z } from "zod";

export type MarketplaceJsonObject = z.infer<typeof marketplaceJsonObjectSchema>;

export type MarketplaceCheckoutRequestItem = z.infer<
  typeof marketplaceCheckoutRequestItemSchema
>;

export type MarketplaceCheckoutCustomer = z.infer<
  typeof marketplaceCheckoutCustomerSchema
>;

export type MarketplaceCheckoutCustomerInput = z.input<
  typeof marketplaceCheckoutCustomerSchema
>;

export type MarketplaceCheckoutRequestInput = z.input<
  typeof marketplaceCheckoutRequestSchema
>;

export type MarketplacePricedCheckoutItem = z.infer<
  typeof marketplacePricedCheckoutItemSchema
>;

export type BuildMarketplaceCheckoutDraftInput = z.input<
  typeof buildMarketplaceCheckoutDraftInputSchema
>;

export type MarketplaceCheckoutTotals = z.infer<
  typeof marketplaceCheckoutTotalsSchema
>;

export type MarketplaceCheckoutItemSnapshot = z.infer<
  typeof marketplaceCheckoutItemSnapshotSchema
>;

export type MarketplaceCheckoutItemRecord = z.infer<
  typeof marketplaceCheckoutItemRecordSchema
>;

export type MarketplaceCheckoutDraft = z.infer<
  typeof marketplaceCheckoutDraftSchema
>;

export type MarketplaceCheckoutStatus = z.infer<
  typeof marketplaceCheckoutStatusSchema
>;

export type MarketplacePaymentProvider = z.infer<
  typeof marketplacePaymentProviderSchema
>;

export type MarketplacePaymentAttemptStatus = z.infer<
  typeof marketplacePaymentAttemptStatusSchema
>;

export type MarketplaceFulfillmentStatus = z.infer<
  typeof marketplaceFulfillmentStatusSchema
>;

export type MarketplaceCheckoutRecord = z.infer<
  typeof marketplaceCheckoutRecordSchema
>;

export type MarketplaceCheckoutPaymentAttemptRecord = z.infer<
  typeof marketplaceCheckoutPaymentAttemptRecordSchema
>;

export type MarketplaceOrderRecord = z.infer<
  typeof marketplaceOrderRecordSchema
>;

export type MarketplaceOrderItemRecord = z.infer<
  typeof marketplaceOrderItemRecordSchema
>;

export type MarketplacePublicToken = z.infer<
  typeof marketplacePublicTokenSchema
>;

export type MarketplacePendingCheckoutState = {
  checkout: MarketplaceCheckoutRecord;
  items: MarketplaceCheckoutItemRecord[];
  paymentAttempt: MarketplaceCheckoutPaymentAttemptRecord | null;
};

export type CreateOrReuseMarketplacePendingCheckoutResult =
  | ({
      ok: true;
      reusedCheckout: boolean;
      reusedPaymentAttempt: boolean;
      requiresPaymentLinkCreation: boolean;
    } & MarketplacePendingCheckoutState)
  | {
      ok: false;
      reason: "unavailable_items";
    };

export type GetMarketplacePendingCheckoutResult =
  | ({
      ok: true;
    } & MarketplacePendingCheckoutState)
  | {
      ok: false;
      reason: "expired" | "not_found";
    };

export type MarketplaceCheckoutPaymentResult =
  | {
      ok: true;
      status: "pending";
      checkoutId: string;
      paymentAttemptId: string;
      paymentReference: string;
      paymentUrl: string;
    }
  | {
      ok: true;
      status: "confirmed";
      checkoutId: string;
      orderId: string;
      paymentUrl: null;
    }
  | {
      ok: false;
      reason:
        | "configuration"
        | "expired"
        | "not_found"
        | "review"
        | "unavailable"
        | "unavailable_items";
      paymentUrl?: string | null;
    };
