import FeedbackPage from "@/app/feedback/page";
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

vi.mock("@/app/actions/feedback", () => ({
  submitFeedback: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  MessageSquare: () => createElement("svg", { "data-slot": "message-icon" }),
}));

describe("FeedbackPage", () => {
  it("marks visible required fields with the shared required label class", () => {
    const html = renderToStaticMarkup(createElement(FeedbackPage));

    expect(html).toContain('class="requiredLabel">Name</span>');
    expect(html).toContain('class="requiredLabel">Email</span>');
    expect(html).toContain('class="requiredLabel">Category</span>');
    expect(html).toContain('class="requiredLabel">Rating</span>');
    expect(html).toContain('class="requiredLabel">Message</span>');
  });
});