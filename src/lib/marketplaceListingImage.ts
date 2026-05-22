import "server-only";

export const marketplaceListingImageKeyPrefix = "listing";

const marketplaceListingImageViewPath = "/api/marketplace/listing-images";

export function isMarketplaceListingImageKey(value: string) {
  const trimmedValue = value.trim();

  return (
    trimmedValue.startsWith(`${marketplaceListingImageKeyPrefix}/`) &&
    trimmedValue.length > marketplaceListingImageKeyPrefix.length + 1 &&
    !trimmedValue.includes("\\")
  );
}

export function isLegacyMarketplaceImageUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  if (trimmedValue.startsWith("/")) {
    return !trimmedValue.startsWith("//");
  }

  try {
    const parsedValue = new URL(trimmedValue);

    return (
      parsedValue.protocol === "http:" || parsedValue.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export function encodeMarketplaceListingImageToken(key: string) {
  return Buffer.from(key, "utf8").toString("base64url");
}

export function decodeMarketplaceListingImageToken(token: string) {
  try {
    const key = Buffer.from(token, "base64url").toString("utf8");

    return isMarketplaceListingImageKey(key) ? key : null;
  } catch {
    return null;
  }
}

export function getMarketplaceListingImageViewPath(key: string) {
  return `${marketplaceListingImageViewPath}/${encodeMarketplaceListingImageToken(key)}`;
}

export function resolveMarketplaceListingImageUrl(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (isMarketplaceListingImageKey(trimmedValue)) {
    return getMarketplaceListingImageViewPath(trimmedValue);
  }

  return isLegacyMarketplaceImageUrl(trimmedValue) ? trimmedValue : null;
}
