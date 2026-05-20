import { z } from "zod";

const checkoutIdSchema = z.string().trim().min(1);
const orderIdSchema = z.string().trim().min(1);
const paymentUrlSchema = z.string().trim().url();

export const marketplaceCreateCheckoutResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    status: z.literal("pending"),
    checkoutId: checkoutIdSchema,
    paymentUrl: paymentUrlSchema,
  }),
  z.object({
    ok: z.literal(true),
    status: z.literal("confirmed"),
    orderId: orderIdSchema,
  }),
  z.object({
    ok: z.literal(true),
    status: z.literal("review"),
  }),
  z.object({
    ok: z.literal(true),
    status: z.literal("unavailable"),
  }),
  z.object({
    ok: z.literal(false),
    status: z.literal("invalid"),
  }),
  z.object({
    ok: z.literal(false),
    status: z.literal("unavailable_items"),
  }),
]);

export const marketplaceCheckoutStatusResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    status: z.literal("pending"),
    paymentUrl: paymentUrlSchema,
  }),
  z.object({
    ok: z.literal(true),
    status: z.literal("confirmed"),
    orderId: orderIdSchema,
  }),
  z.object({
    ok: z.literal(true),
    status: z.enum(["review", "expired", "unavailable"]),
  }),
  z.object({
    ok: z.literal(false),
    status: z.enum(["invalid", "not_found"]),
  }),
]);

export type MarketplaceCreateCheckoutResponse = z.infer<
  typeof marketplaceCreateCheckoutResponseSchema
>;

export type MarketplaceCheckoutStatusResponse = z.infer<
  typeof marketplaceCheckoutStatusResponseSchema
>;
