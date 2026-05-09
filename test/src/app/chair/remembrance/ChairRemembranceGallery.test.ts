import { ChairRemembranceGallery } from "@/app/chair/remembrance/ChairRemembranceGallery";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/chair/chair.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/chair/remembrance/RemembrancePhotoCard", () => ({
  RemembrancePhotoCard: ({ photo }: { photo: { title: string } }) =>
    createElement("article", null, photo.title),
}));

describe("ChairRemembranceGallery", () => {
  it("renders the server pagination summary when pagination is provided", () => {
    const html = renderToStaticMarkup(
      createElement(ChairRemembranceGallery, {
        pagination: {
          currentCount: 1,
          endIndex: 51,
          hasNextPage: false,
          hasPreviousPage: true,
          isEmpty: false,
          page: 2,
          pageKey: "page",
          pageSize: 50,
          pageSizeKey: "pageSize",
          skip: 50,
          startIndex: 51,
          take: 50,
          totalCount: 51,
          totalPages: 2,
        },
        photos: [
          {
            caption: "Sunrise remembrance",
            id: "photo-51",
            note: "In loving memory.",
            notePreview: "In loving memory.",
            receivedAtLabel: "2026-05-01T12:00:00.000Z",
            submitterEmail: "ada@example.com",
            submitterName: "Ada",
            title: "Sunrise remembrance",
          },
        ],
      }),
    );

    expect(html).toContain("Showing 51-51 of 51");
    expect(html).not.toContain(
      "Showing 1 of 1 remembrance photos on this page",
    );
  });
});
