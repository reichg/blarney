import { z } from "zod";

export const checkoutStatusSchema = z.object({
  checkoutId: z.string().trim().min(1),
});

export type CheckoutStatusRouteContext = {
  params: Promise<{
    checkoutId: string;
  }>;
};
