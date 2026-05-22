import { z } from "zod";

const marketplaceListingImageUploadResponseSchema = z.object({
  imageKey: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
});

export async function uploadMarketplaceListingImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/chair/marketplace/listing-images/upload", {
    body: formData,
    method: "POST",
  });

  const body = (await response.json().catch(() => null)) as
    | {
        imageKey?: string;
        imageUrl?: string;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(body?.message ?? "Listing image upload could not be prepared.");
  }

  const parsedResponse =
    marketplaceListingImageUploadResponseSchema.safeParse(body);

  if (!parsedResponse.success) {
    throw new Error("Listing image upload could not be prepared.");
  }

  return {
    imageKey: parsedResponse.data.imageKey,
    imageUrl: parsedResponse.data.imageUrl,
  };
}