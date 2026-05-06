import PhotosPage from "@/app/photos/page";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { photoCountMock, photoFindManyMock } = vi.hoisted(() => ({
  photoCountMock: vi.fn(),
  photoFindManyMock: vi.fn(),
}));

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

vi.mock("@/app/forms.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("./photos.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/PaginationNav", () => ({
  PaginationNav: () => createElement("nav", { "data-slot": "pagination" }),
}));

vi.mock("@/components/PhotoUploadForm", () => ({
  PhotoUploadForm: () =>
    createElement("div", { "data-slot": "upload-form" }, "Upload form"),
}));

vi.mock("./PhotoGallery", () => ({
  PhotoGallery: () =>
    createElement("div", { "data-slot": "photo-gallery" }, "Gallery"),
}));

vi.mock("@/lib/db", () => ({
  db: {
    photoSubmission: {
      count: photoCountMock,
      findMany: photoFindManyMock,
    },
  },
}));

beforeEach(() => {
  photoFindManyMock.mockResolvedValue([
    {
      id: "photo-1",
      caption: "Team photo",
    },
  ]);
  photoCountMock.mockResolvedValue(1);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PhotosPage", () => {
  it("renders the upload form before the approved gallery", async () => {
    const html = renderToStaticMarkup(
      await PhotosPage({
        searchParams: Promise.resolve({}),
      }),
    );
    const uploadFormIndex = html.indexOf('data-slot="upload-form"');
    const photoGalleryIndex = html.indexOf('data-slot="photo-gallery"');

    expect(uploadFormIndex).toBeGreaterThan(-1);
    expect(photoGalleryIndex).toBeGreaterThan(-1);
    expect(uploadFormIndex).toBeLessThan(photoGalleryIndex);
    expect(html).toContain("Share a tournament moment");
  });
});
