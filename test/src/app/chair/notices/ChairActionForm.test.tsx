import { ChairActionForm } from "@/app/chair/notices/ChairActionForm";
import type { ChairFormAction } from "@/app/chair/notices/type";
import {
  PAIRING_NOTICES,
  PAIRINGS_NOTICE_PARAM,
} from "@/app/chair/pairings/pairingNotices";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace, showToast } = vi.hoisted(() => ({
  replace: vi.fn(),
  showToast: vi.fn(),
}));

// The wrapper navigates via the router instead of a server-side redirect(), so
// chair pages keep their scroll position after an action.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

// Notices are surfaced through the chair toast context rather than banners.
vi.mock("@/app/chair/notices/ChairActionToast", () => ({
  useChairActionToast: () => ({ showToast }),
  ChairActionToastProvider: ({ children }: { children: unknown }) => children,
}));

afterEach(() => {
  vi.clearAllMocks();
});

// Runs the wrapper under a React render so useChairActionNavigation binds the
// mocked router, then returns the <form> element it produced. This exposes the
// real submit handler React assigned to form.action without needing a DOM.
function renderFormElement(action: ChairFormAction): ReactElement {
  let formElement: ReactElement | undefined;

  function Harness() {
    formElement = ChairActionForm({
      action,
      children: null,
      notices: PAIRING_NOTICES,
      param: PAIRINGS_NOTICE_PARAM,
    }) as ReactElement;
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!formElement || formElement.type !== "form") {
    throw new Error("ChairActionForm did not render a form");
  }

  return formElement;
}

function getSubmitHandler(formElement: ReactElement) {
  return (formElement.props as { action: (formData: FormData) => Promise<void> })
    .action;
}

describe("ChairActionForm", () => {
  it("renders a form with the given class wrapping its children", () => {
    const action = vi.fn<ChairFormAction>(async () => undefined);

    const html = renderToStaticMarkup(
      <ChairActionForm
        action={action}
        className="compactForm"
        notices={PAIRING_NOTICES}
        param={PAIRINGS_NOTICE_PARAM}
      >
        <button type="submit">Publish draft</button>
      </ChairActionForm>,
    );

    expect(html).toContain("<form");
    expect(html).toContain('class="compactForm"');
    expect(html).toContain("Publish draft");
  });

  it("toasts a success notice and navigates without scrolling on submit", async () => {
    const action = vi.fn<ChairFormAction>(async () => ({
      redirectTo: "/chair/pairings?pairings=published",
    }));

    const submitHandler = getSubmitHandler(renderFormElement(action));

    expect(submitHandler).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("returnTo", "/chair/pairings");

    await submitHandler(formData);

    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(formData);
    expect(showToast).toHaveBeenCalledWith(PAIRING_NOTICES.published);
    expect(replace).toHaveBeenCalledWith("/chair/pairings?pairings=published", {
      scroll: false,
    });
  });

  it("toasts an error notice without navigating, so scroll and view are kept", async () => {
    const action = vi.fn<ChairFormAction>(async () => ({
      redirectTo: "/chair/pairings?pairings=action-failed",
    }));

    const submitHandler = getSubmitHandler(renderFormElement(action));

    await submitHandler(new FormData());

    expect(showToast).toHaveBeenCalledWith(PAIRING_NOTICES["action-failed"]);
    expect(replace).not.toHaveBeenCalled();
  });
});
