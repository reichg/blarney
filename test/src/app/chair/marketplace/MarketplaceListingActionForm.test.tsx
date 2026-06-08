import { MarketplaceListingActionForm } from "@/app/chair/marketplace/MarketplaceListingActionForm";
import type { MarketplaceFormAction } from "@/app/chair/marketplace/useMarketplaceActionNavigation";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn(),
}));

// The wrapper navigates via the router instead of a server-side redirect(), so
// the chair marketplace page keeps its scroll position after a listing action.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// Runs the wrapper under a React render so useMarketplaceActionNavigation binds
// the mocked router, then returns the <form> element it produced. This exposes
// the real submit handler React assigned to form.action without needing a DOM.
function renderFormElement(action: MarketplaceFormAction): ReactElement {
  let formElement: ReactElement | undefined;

  function Harness() {
    formElement = MarketplaceListingActionForm({
      action,
      children: null,
    }) as ReactElement;
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!formElement || formElement.type !== "form") {
    throw new Error("MarketplaceListingActionForm did not render a form");
  }

  return formElement;
}

describe("MarketplaceListingActionForm", () => {
  it("renders a form wrapping its children", () => {
    const action = vi.fn<MarketplaceFormAction>(async () => undefined);

    const html = renderToStaticMarkup(
      <MarketplaceListingActionForm action={action} className="card">
        <button type="submit">Archive listing</button>
      </MarketplaceListingActionForm>,
    );

    expect(html).toContain("<form");
    expect(html).toContain('class="card"');
    expect(html).toContain("Archive listing");
  });

  it("navigates to the returned notice url without scrolling on submit", async () => {
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=listing-archived",
    }));

    const formElement = renderFormElement(action);
    const submitHandler = (
      formElement.props as { action: (formData: FormData) => Promise<void> }
    ).action;

    expect(submitHandler).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("listingId", "listing-1");

    await submitHandler(formData);

    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(formData);
    expect(replace).toHaveBeenCalledWith(
      "/chair/marketplace?marketplace=listing-archived",
      { scroll: false },
    );
  });

  it("does not navigate when the action returns no redirect", async () => {
    const action = vi.fn<MarketplaceFormAction>(async () => undefined);

    const formElement = renderFormElement(action);
    const submitHandler = (
      formElement.props as { action: (formData: FormData) => Promise<void> }
    ).action;

    await submitHandler(new FormData());

    expect(action).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
