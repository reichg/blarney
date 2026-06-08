import { MarketplaceListingForm } from "@/app/chair/marketplace/MarketplaceListingForm";
import { useMarketplaceActionNavigation } from "@/app/chair/marketplace/useMarketplaceActionNavigation";
import type { MarketplaceFormAction } from "@/app/chair/marketplace/useMarketplaceActionNavigation";
import { PreviewDetailCardCloseProvider } from "@/app/chair/PreviewDetailCardContext";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace, showToast } = vi.hoisted(() => ({
  replace: vi.fn(),
  showToast: vi.fn(),
}));

// The hook navigates via the router instead of a server-side redirect(), so the
// chair marketplace page keeps its scroll position after a listing action.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

// Error notices are surfaced through the toast context rather than navigation.
vi.mock("@/app/chair/marketplace/MarketplaceActionToast", () => ({
  useMarketplaceToast: () => showToast,
  MarketplaceActionToastProvider: ({ children }: { children: unknown }) =>
    children,
}));

afterEach(() => {
  vi.clearAllMocks();
});

// Renders a component that consumes useMarketplaceActionNavigation under a React
// render so the hook binds the mocked router, then hands the bound runner back so
// the test can invoke the function React would assign to form.action.
function captureRunMarketplaceAction(): ReturnType<
  typeof useMarketplaceActionNavigation
> {
  let runMarketplaceAction:
    | ReturnType<typeof useMarketplaceActionNavigation>
    | undefined;

  function Harness() {
    runMarketplaceAction = useMarketplaceActionNavigation();
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!runMarketplaceAction) {
    throw new Error("useMarketplaceActionNavigation did not return a runner");
  }

  return runMarketplaceAction;
}

describe("useMarketplaceActionNavigation onResult contract", () => {
  it("invokes onResult before navigating when the action returns a redirect", async () => {
    const calls: string[] = [];
    const onResult = vi.fn(() => {
      calls.push("onResult");
    });
    replace.mockImplementation(() => {
      calls.push("replace");
    });

    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=listing-saved",
    }));

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onResult })(new FormData());

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      "/chair/marketplace?marketplace=listing-saved",
      { scroll: false },
    );
    // onResult must close the modal before the route swaps under it.
    expect(calls).toEqual(["onResult", "replace"]);
  });

  it("does not call onResult or navigate when the action returns no redirect", async () => {
    const onResult = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => undefined);

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onResult })(new FormData());

    expect(action).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("calls onSettled after a redirecting action so pending UI can reset", async () => {
    const onSettled = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=listing-saved",
    }));

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onSettled })(new FormData());

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("calls onSettled when the action returns no redirect", async () => {
    const onSettled = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => undefined);

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onSettled })(new FormData());

    expect(replace).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("navigates without an onResult callback when one is not provided", async () => {
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=listing-saved",
    }));

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action)(new FormData());

    expect(replace).toHaveBeenCalledWith(
      "/chair/marketplace?marketplace=listing-saved",
      { scroll: false },
    );
  });
});

describe("useMarketplaceActionNavigation error toast contract", () => {
  it("toasts the error notice without navigating or calling onResult", async () => {
    const onResult = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo:
        "/chair/marketplace?marketplace=catalog-requires-active-variant",
    }));

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onResult })(new FormData());

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: "error",
        title: "Publishing requires an active variant.",
      }),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("still runs onSettled after surfacing an error toast", async () => {
    const onSettled = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=catalog-error",
    }));

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onSettled })(new FormData());

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("toasts a success notice and still navigates to revalidate", async () => {
    const onResult = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=listing-published",
    }));

    const runMarketplaceAction = captureRunMarketplaceAction();
    await runMarketplaceAction(action, { onResult })(new FormData());

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: "success",
        title: "Marketplace listing published.",
      }),
    );
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      "/chair/marketplace?marketplace=listing-published",
      { scroll: false },
    );
  });
});

// Confirms MarketplaceListingForm wires its enclosing PreviewDetailCard close
// callback into runMarketplaceAction's onResult, so a successful save closes the
// modal. The component is invoked under a render context wrapped in the close
// provider; the bound form.action is then exercised with a redirecting stub.
function renderListingFormAction(
  action: MarketplaceFormAction,
  close: () => void,
): (formData: FormData) => Promise<void> {
  let formElement: ReactElement | undefined;

  function Harness() {
    formElement = MarketplaceListingForm({
      action,
      children: null,
      fieldId: "listing-image",
      pendingSubmitLabel: "Saving...",
      submitLabel: "Save listing",
      uploadPendingLabel: "Uploading...",
    }) as ReactElement;
    return null;
  }

  renderToStaticMarkup(
    <PreviewDetailCardCloseProvider value={close}>
      <Harness />
    </PreviewDetailCardCloseProvider>,
  );

  if (!formElement || formElement.type !== "form") {
    throw new Error("MarketplaceListingForm did not render a form");
  }

  return (
    formElement.props as { action: (formData: FormData) => Promise<void> }
  ).action;
}

describe("MarketplaceListingForm modal close wiring", () => {
  it("closes the enclosing PreviewDetailCard when a save returns a redirect", async () => {
    const close = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => ({
      redirectTo: "/chair/marketplace?marketplace=listing-saved",
    }));

    const submitHandler = renderListingFormAction(action, close);
    await submitHandler(new FormData());

    expect(action).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      "/chair/marketplace?marketplace=listing-saved",
      { scroll: false },
    );
  });

  it("does not close the modal when a save returns no redirect", async () => {
    const close = vi.fn();
    const action = vi.fn<MarketplaceFormAction>(async () => undefined);

    const submitHandler = renderListingFormAction(action, close);
    await submitHandler(new FormData());

    expect(action).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
