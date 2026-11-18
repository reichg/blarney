const DEV_ORIGIN = "http://localhost:3001";

/**
 * The public origin of the site: NEXT_PUBLIC_SITE_URL, or the local dev origin
 * when it is unset or not a valid URL. Metadata, the sitemap and robots.txt all
 * read it here so they cannot disagree about where the site lives.
 */
export function getSiteOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configured) {
    return new URL(DEV_ORIGIN);
  }

  try {
    return new URL(configured);
  } catch {
    return new URL(DEV_ORIGIN);
  }
}
