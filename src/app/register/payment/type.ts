import { z } from "zod";

export const paymentRequestSchema = z.object({
  checkout: z.string().trim().min(1).optional(),
  registration: z.string().trim().min(1).optional(),
  rsvpCheckout: z.string().trim().min(1).optional(),
});
