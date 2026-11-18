import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const PUBLIC_PATHS = [
  "/",
  "/register",
  "/marketplace",
  "/logistics",
  "/photos",
  "/feedback",
  "/remembrance",
];

function sitemapUrls(): string[] {
  return sitemap().map((entry) => entry.url);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lists every public page on the configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blarney.example");

    expect(sitemapUrls()).toEqual(
      PUBLIC_PATHS.map((path) => `https://blarney.example${path}`),
    );
  });

  it("lists each URL once", () => {
    const urls = sitemapUrls();

    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves out the chair portal, API, thank-you pages and checkout", () => {
    const paths = sitemapUrls().map((url) => new URL(url).pathname);

    for (const path of paths) {
      expect(path).not.toMatch(/^\/(chair|api)/);
      expect(path).not.toMatch(/thanks|checkout|payment/);
    }
  });

  it("falls back to the local dev origin when the site URL is unset or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(sitemapUrls()).toContain("http://localhost:3001/");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(sitemapUrls()).toContain("http://localhost:3001/");
  });
});

describe("robots", () => {
  it("allows the site, blocks the API, and points at the sitemap", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blarney.example");

    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://blarney.example/sitemap.xml",
    });
  });
});
