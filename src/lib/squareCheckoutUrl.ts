const trustedSquareCheckoutHosts = [
  "square.link",
  "squareup.com",
  "squareupsandbox.com",
  "square.site",
] as const;

function matchesTrustedHost(hostname: string) {
  return trustedSquareCheckoutHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function isTrustedSquareCheckoutUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.protocol === "https:" &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      matchesTrustedHost(parsedUrl.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
