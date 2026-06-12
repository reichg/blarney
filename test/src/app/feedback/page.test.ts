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

// FeedbackForm binds useActionNavigation (and thus useRouter) during render,
// which throws "router not mounted" outside the app router. The toast context
// safely no-ops without a provider, so only navigation needs a double here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("lucide-react", () => ({
  MessageSquare: () => createElement("svg", { "data-slot": "message-icon" }),
  UsersRound: () => createElement("svg", { "data-slot": "users-icon" }),
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
