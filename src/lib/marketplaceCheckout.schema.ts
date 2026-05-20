import { z } from "zod";

const maxMarketplaceLineItems = 25;
const maxMarketplaceQuantityPerLine = 25;

const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

const moneyAmountSchema = z.number().int().min(0);

const optionalCustomerTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .nullish()
  .transform((value) => value ?? null);

type MarketplaceJsonObject = { [key: string]: MarketplaceJsonValue };

type MarketplaceJsonValue =
  | string
  | number
  | boolean
  | null
  | MarketplaceJsonValue[]
  | MarketplaceJsonObject;

const marketplaceJsonValueSchema: z.ZodType<MarketplaceJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(marketplaceJsonValueSchema),
    z.record(z.string(), marketplaceJsonValueSchema),
  ]),
);

export const marketplaceJsonObjectSchema: z.ZodType<MarketplaceJsonObject> =
  z.record(z.string(), marketplaceJsonValueSchema);

function addDuplicateVariantIssues(
  items: Array<{ variantId: string }>,
  ctx: z.RefinementCtx,
) {
  const seenVariantIds = new Set<string>();

  items.forEach((item, index) => {
    if (seenVariantIds.has(item.variantId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each marketplace variant can appear only once per checkout.",
        path: ["items", index, "variantId"],
      });
    }

    seenVariantIds.add(item.variantId);
  });
}

export const marketplaceCheckoutStatusSchema = z.enum([
  "PENDING",
  "PAYMENT_REVIEW",
  "CONFIRMED",
  "EXPIRED",
  "CANCELED",
]);

export const marketplacePaymentProviderSchema = z.enum(["SQUARE"]);

export const marketplacePaymentAttemptStatusSchema = z.enum([
  "PENDING",
  "OPEN",
  "REVIEW",
  "COMPLETED",
  "EXPIRED",
  "CANCELED",
]);

export const marketplaceFulfillmentStatusSchema = z.enum([
  "UNFULFILLED",
  "READY",
  "FULFILLED",
  "CANCELED",
]);

export const marketplaceCheckoutHashSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/i);

export const marketplacePublicTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32}$/i);

export const marketplaceCheckoutRequestItemSchema = z.object({
  variantId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(maxMarketplaceQuantityPerLine),
});

export const marketplaceCheckoutCustomerSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase())
    .nullish()
    .transform((value) => value ?? null),
  name: optionalCustomerTextSchema,
  phone: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .nullish()
    .transform((value) => value ?? null),
});

export const marketplaceCheckoutRequestSchema = z.object({
  items: z
    .array(marketplaceCheckoutRequestItemSchema)
    .min(1)
    .max(maxMarketplaceLineItems),
  customer: marketplaceCheckoutCustomerSchema
    .nullish()
    .transform((value) => value ?? null),
  requestSnapshot: marketplaceJsonObjectSchema
    .nullish()
    .transform((value) => value ?? null),
});

export const marketplacePricedCheckoutItemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  variantLabel: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullish()
    .transform((value) => value ?? null),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullish()
    .transform((value) => value ?? null),
  quantity: z.number().int().min(1).max(maxMarketplaceQuantityPerLine),
  currency: currencySchema,
  unitAmount: moneyAmountSchema,
  detailSnapshot: marketplaceJsonObjectSchema,
});

export const buildMarketplaceCheckoutDraftInputSchema = z
  .object({
    items: z
      .array(marketplacePricedCheckoutItemSchema)
      .min(1)
      .max(maxMarketplaceLineItems),
    customer: marketplaceCheckoutCustomerSchema
      .nullish()
      .transform((value) => value ?? null),
    requestSnapshot: marketplaceJsonObjectSchema
      .nullish()
      .transform((value) => value ?? null),
    taxAmount: moneyAmountSchema.default(0),
    shippingAmount: moneyAmountSchema.default(0),
    discountAmount: moneyAmountSchema.default(0),
  })
  .superRefine((value, ctx) => {
    addDuplicateVariantIssues(value.items, ctx);
  });

export const marketplaceCheckoutTotalsSchema = z.object({
  currency: currencySchema,
  subtotalAmount: moneyAmountSchema,
  taxAmount: moneyAmountSchema,
  shippingAmount: moneyAmountSchema,
  discountAmount: moneyAmountSchema,
  totalAmount: moneyAmountSchema,
});

export const marketplaceCheckoutItemSnapshotSchema = z.object({
  lineNumber: z.number().int().min(1),
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  variantLabel: z.string().trim().min(1).max(120).nullable(),
  sku: z.string().trim().min(1).max(120).nullable(),
  quantity: z.number().int().min(1).max(maxMarketplaceQuantityPerLine),
  currency: currencySchema,
  unitAmount: moneyAmountSchema,
  totalAmount: moneyAmountSchema,
  detailSnapshot: marketplaceJsonObjectSchema,
});

export const marketplaceCheckoutDraftSchema = z.object({
  snapshotHash: marketplaceCheckoutHashSchema,
  items: z
    .array(marketplaceCheckoutItemSnapshotSchema)
    .min(1)
    .max(maxMarketplaceLineItems),
  totals: marketplaceCheckoutTotalsSchema,
  customerSnapshot: marketplaceCheckoutCustomerSchema.nullable(),
  requestSnapshot: marketplaceJsonObjectSchema.nullable(),
});

export const marketplaceCheckoutItemRecordSchema = z.object({
  id: z.string().trim().min(1),
  checkoutId: z.string().trim().min(1),
  listingId: z.string().trim().min(1).nullable(),
  variantId: z.string().trim().min(1).nullable(),
  lineNumber: z.number().int().min(1),
  title: z.string().trim().min(1).max(200),
  variantLabel: z.string().trim().min(1).max(120).nullable(),
  sku: z.string().trim().min(1).max(120).nullable(),
  quantity: z.number().int().min(1).max(maxMarketplaceQuantityPerLine),
  currency: currencySchema,
  unitAmount: moneyAmountSchema,
  totalAmount: moneyAmountSchema,
  detailSnapshot: marketplaceJsonObjectSchema,
  createdAt: z.date(),
});

export const marketplaceCheckoutRecordSchema = z.object({
  id: z.string().trim().min(1),
  idempotencyKey: marketplaceCheckoutHashSchema,
  publicTokenHash: marketplaceCheckoutHashSchema,
  snapshotHash: marketplaceCheckoutHashSchema,
  buyerEmail: z.string().email().nullable(),
  buyerName: z.string().trim().min(1).nullable(),
  status: marketplaceCheckoutStatusSchema,
  currency: currencySchema,
  subtotalAmount: moneyAmountSchema,
  taxAmount: moneyAmountSchema,
  shippingAmount: moneyAmountSchema,
  discountAmount: moneyAmountSchema,
  totalAmount: moneyAmountSchema,
  requestSnapshot: z.unknown().nullable(),
  customerSnapshot: z.unknown().nullable(),
  expiresAt: z.date(),
  confirmedAt: z.date().nullable(),
  canceledAt: z.date().nullable(),
  expiredAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const marketplaceCheckoutPaymentAttemptRecordSchema = z.object({
  id: z.string().trim().min(1),
  checkoutId: z.string().trim().min(1),
  provider: marketplacePaymentProviderSchema,
  status: marketplacePaymentAttemptStatusSchema,
  idempotencyKey: marketplaceCheckoutHashSchema,
  expectedCurrency: currencySchema,
  expectedTotalAmount: moneyAmountSchema,
  providerLinkId: z.string().trim().min(1).nullable(),
  providerOrderId: z.string().trim().min(1).nullable(),
  providerPaymentId: z.string().trim().min(1).nullable(),
  paymentUrl: z.string().trim().url().nullable(),
  expiresAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  lastReconciledAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const marketplaceOrderRecordSchema = z.object({
  id: z.string().trim().min(1),
  checkoutId: z.string().trim().min(1),
  publicTokenHash: marketplaceCheckoutHashSchema,
  buyerEmail: z.string().email().nullable(),
  buyerName: z.string().trim().min(1).nullable(),
  currency: currencySchema,
  subtotalAmount: moneyAmountSchema,
  taxAmount: moneyAmountSchema,
  shippingAmount: moneyAmountSchema,
  discountAmount: moneyAmountSchema,
  totalAmount: moneyAmountSchema,
  customerSnapshot: z.unknown().nullable(),
  paymentProvider: marketplacePaymentProviderSchema,
  providerOrderId: z.string().trim().min(1).nullable(),
  fulfillmentStatus: marketplaceFulfillmentStatusSchema,
  confirmedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const marketplaceOrderItemRecordSchema = z.object({
  id: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  listingId: z.string().trim().min(1).nullable(),
  variantId: z.string().trim().min(1).nullable(),
  lineNumber: z.number().int().min(1),
  title: z.string().trim().min(1).max(200),
  variantLabel: z.string().trim().min(1).max(120).nullable(),
  sku: z.string().trim().min(1).max(120).nullable(),
  quantity: z.number().int().min(1).max(maxMarketplaceQuantityPerLine),
  currency: currencySchema,
  unitAmount: moneyAmountSchema,
  totalAmount: moneyAmountSchema,
  detailSnapshot: marketplaceJsonObjectSchema,
  createdAt: z.date(),
});
