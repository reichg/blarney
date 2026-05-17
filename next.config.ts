import type { NextConfig } from "next";

function getHostFromUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).host;
  } catch {
    return value.trim() || undefined;
  }
}

const allowedDevOrigins = Array.from(
  new Set(
    [
      "localhost:3001",
      "127.0.0.1:3001",
      "blarney42.com",
      "blarney42.gabe-reichenberger.com",
      "*.trycloudflare.com",
      getHostFromUrl(process.env.NEXT_PUBLIC_SITE_URL),
      getHostFromUrl(process.env.CLOUDFLARED_TUNNEL_URL),
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
