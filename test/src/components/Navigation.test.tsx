import { Navigation } from "@/components/Navigation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

vi.mock("@/components/Navigation.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/MobileNavigation", () => ({
  MobileNavigation: ({
    links,
  }: {
    links: Array<{ href: string; label: string }>;
  }) =>
    createElement("div", {
      "data-slot": "mobile-navigation",
      "data-links": links.map((link) => `${link.label}:${link.href}`).join("|"),
    }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Navigation", () => {
  it("includes the marketplace link in the chair navbar", () => {
    usePathname.mockReturnValue("/chair/marketplace");

    const html = renderToStaticMarkup(createElement(Navigation));

    expect(html).toContain('aria-label="Chair navigation"');
    expect(html).toContain('href="/chair/marketplace"');
    expect(html).toContain("Marketplace</a>");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(
      'data-links="Dashboard:/chair|Golf Registrations:/chair/registrations|BBQ RSVPs:/chair/rsvps|Marketplace:/chair/marketplace|Feedback:/chair/feedback|Photos:/chair/photos|Remembrance:/chair/remembrance|Pairings:/chair/pairings"',
    );
  });
});
