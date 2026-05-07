import { RemembranceForm } from "@/app/remembrance/RemembranceForm";
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

vi.mock("@/app/remembrance/remembrance.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/PhotoBrowsePicker", () => ({
  PhotoBrowsePicker: () =>
    createElement("div", { "data-slot": "photo-picker" }, "Photo picker"),
  getSelectedPhotoFiles: () => [],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("RemembranceForm", () => {
  it("requires message, name, and email while leaving photos optional", () => {
    const html = renderToStaticMarkup(createElement(RemembranceForm));

    expect(html).toContain('class="requiredLabel">Remembrance message</span>');
    expect(html).toContain('class="requiredLabel">Name</span>');
    expect(html).toContain('class="requiredLabel">Email</span>');
    expect(html).toMatch(
      /<textarea(?=[^>]*name="message")(?=[^>]*required)[^>]*>/,
    );
    expect(html).toMatch(/<input(?=[^>]*name="name")(?=[^>]*required)[^>]*>/);
    expect(html).toMatch(/<input(?=[^>]*name="email")(?=[^>]*required)[^>]*>/);
    expect(html).toContain("Photos are optional.");
    expect(html).toContain(">Optional photos</legend>");
    expect(html).toContain('data-slot="photo-picker"');
  });
});
