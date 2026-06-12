import { FeedbackForm } from "@/app/feedback/FeedbackForm";
import { FEEDBACK_NOTICES } from "@/app/feedback/feedbackNotices";
import type { NoticeFormAction } from "@/components/notices/type";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { clearDraft, handleChange, replace, showToast } = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  handleChange: vi.fn(),
  replace: vi.fn(),
  showToast: vi.fn(),
}));

// The form navigates via the router instead of a server-side redirect(), so
// the page keeps its scroll position after a submission.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

// Error notices surface through the shared toast context, not navigation.
vi.mock("@/components/notices/ActionToast", () => ({
  useActionToast: () => ({ showToast }),
  ActionToastProvider: ({ children }: { children: unknown }) => children,
}));

// The draft hook owns localStorage; the form's contract is only when it asks
// the hook to clear, so the hook is doubled rather than storage simulated.
vi.mock("@/lib/useFormDraft", () => ({
  useUncontrolledFormDraft: () => ({
    wasRestored: false,
    clearDraft,
    handleChange,
  }),
}));

vi.mock("@/app/forms.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("lucide-react", () => ({
  MessageSquare: () => createElement("svg", { "data-slot": "message-icon" }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// Invokes FeedbackForm under a React render so its hooks bind the mocked
// router and toast, then hands back the bound function React would assign to
// form.action so tests can drive a submission directly.
function renderFeedbackFormAction(
  action: NoticeFormAction,
): (formData: FormData) => Promise<void> {
  let formElement: ReactElement | undefined;

  function Harness() {
    formElement = FeedbackForm({ submitFeedback: action }) as ReactElement;
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!formElement || formElement.type !== "form") {
    throw new Error("FeedbackForm did not render a form");
  }

  return (
    formElement.props as { action: (formData: FormData) => Promise<void> }
  ).action;
}

describe("FeedbackForm submission outcomes", () => {
  it("clears the draft before navigating when the action succeeds", async () => {
    const calls: string[] = [];
    clearDraft.mockImplementation(() => {
      calls.push("clearDraft");
    });
    replace.mockImplementation(() => {
      calls.push("replace");
    });

    const action = vi.fn<NoticeFormAction>(async () => ({
      redirectTo: "/feedback/thanks",
    }));

    const submitHandler = renderFeedbackFormAction(action);
    await submitHandler(new FormData());

    expect(action).toHaveBeenCalledTimes(1);
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/feedback/thanks", {
      scroll: false,
    });
    // The draft must be gone before the route swaps away from the form.
    expect(calls).toEqual(["clearDraft", "replace"]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts the error notice and preserves the draft without navigating on failure", async () => {
    const action = vi.fn<NoticeFormAction>(async () => ({
      redirectTo: "/feedback?feedback=submit-failed",
    }));

    const submitHandler = renderFeedbackFormAction(action);
    await submitHandler(new FormData());

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(FEEDBACK_NOTICES["submit-failed"]);
    expect(replace).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
  });
});
