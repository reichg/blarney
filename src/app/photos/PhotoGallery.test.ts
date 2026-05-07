import { PhotoGallery } from "@/app/photos/PhotoGallery";
import { createElement, type ElementType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

vi.mock("./photos.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/ModularCard", () => ({
  ModularCard: ({
    as,
    children,
    className,
  }: {
    as?: ElementType;
    children: ReactNode;
    className?: string;
  }) => {
    const Component = as ?? "article";

    return createElement(Component, { className }, children);
  },
}));

describe("PhotoGallery", () => {
  it("renders consistent preview-card content with caption truncation hooks", () => {
    const html = renderToStaticMarkup(
      createElement(PhotoGallery, {
        photos: [
          {
            id: "photo-1",
            caption:
              "Sample remembrance caption 008 with enough detail to test preview wrapping.",
          },
          {
            id: "photo-2",
            caption: null,
          },
        ],
      }),
    );

    expect(html).toContain("Approved photo");
    expect(html).toContain("View full photo");
    expect(html).toContain('class="photoCaption"');
    expect(html).toContain(
      'title="Sample remembrance caption 008 with enough detail to test preview wrapping."',
    );
    expect(html).toContain("Approved gallery photo");
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
