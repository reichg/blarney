import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { createElement } from "react";
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

vi.mock("@/app/forms.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/PhotoUploadForm.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/PhotoBrowsePicker", () => ({
  PhotoBrowsePicker: () =>
    createElement("div", { "data-slot": "photo-picker" }, "Photo picker"),
  getSelectedPhotoFiles: () => [],
}));

vi.mock("lucide-react", () => ({
  Upload: () => createElement("svg", { "data-slot": "upload-icon" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("PhotoUploadForm", () => {
  it("renders the same core upload controls after the layout update", () => {
    const html = renderToStaticMarkup(createElement(PhotoUploadForm));

    expect(html).toContain("Add your contact info");
    expect(html).toContain('class="requiredLabel">Name</span>');
    expect(html).toContain('class="requiredLabel">Email</span>');
    expect(html).toContain('class="requiredLabel">Photos</legend>');
    expect(html).toContain("Caption (optional)");
    expect(html).toContain('name="submitterName"');
    expect(html).toContain('name="submitterEmail"');
    expect(html).toContain('name="caption"');
    expect(html).not.toMatch(/<textarea[^>]*name="caption"[^>]*required/);
    expect(html).toContain('data-slot="photo-picker"');
    expect(html).toContain("Choose at least one photo.");
    expect(html).toContain("Submit for review");
  });
});
