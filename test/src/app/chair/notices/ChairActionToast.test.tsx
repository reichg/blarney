// @vitest-environment jsdom

import {
  ChairActionToastProvider,
  useChairActionToast,
} from "@/app/chair/notices/ChairActionToast";
import type { ChairNotice } from "@/app/chair/notices/type";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/chair/chair.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

// Mirrors TOAST_AUTO_DISMISS_MS in ChairActionToast.tsx (not exported).
const AUTO_DISMISS_MS = 5000;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

// Mounts the provider with a child that captures the context's showToast so
// tests can drive notices the way an action hook would.
function renderProvider(): (notice: ChairNotice) => void {
  let showToast: ((notice: ChairNotice) => void) | undefined;

  function Capture() {
    showToast = useChairActionToast().showToast;
    return null;
  }

  act(() => {
    root.render(
      <ChairActionToastProvider>
        <Capture />
      </ChairActionToastProvider>,
    );
  });

  if (!showToast) {
    throw new Error("ChairActionToastProvider did not provide showToast");
  }

  return showToast;
}

function getToast(role: "status" | "alert") {
  return container.querySelector(`[role="${role}"]`);
}

describe("ChairActionToastProvider", () => {
  it("renders a success notice as role=status and auto-dismisses it", () => {
    const showToast = renderProvider();

    act(() => {
      showToast({ tone: "success", title: "Saved.", body: "All good." });
    });

    const toast = getToast("status");
    expect(toast?.textContent).toContain("Saved.");
    expect(toast?.textContent).toContain("All good.");

    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS);
    });

    expect(getToast("status")).toBeNull();
  });

  it("renders an error notice as role=alert that persists past the auto-dismiss window", () => {
    const showToast = renderProvider();

    act(() => {
      showToast({ tone: "error", title: "It failed." });
    });

    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS * 2);
    });

    expect(getToast("alert")?.textContent).toContain("It failed.");
  });

  it("dismisses the toast when the dismiss button is clicked", () => {
    const showToast = renderProvider();

    act(() => {
      showToast({ tone: "error", title: "It failed." });
    });

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss notice"]',
    );
    expect(dismiss).not.toBeNull();

    act(() => {
      dismiss?.click();
    });

    expect(getToast("alert")).toBeNull();
  });

  it("dismisses on a backdrop click but not on a click inside the notice card", () => {
    const showToast = renderProvider();

    act(() => {
      showToast({ tone: "error", title: "It failed." });
    });

    const toast = getToast("alert");
    const backdrop = toast?.parentElement as HTMLElement;

    // A click landing on the card itself must not dismiss.
    act(() => {
      (toast as HTMLElement).click();
    });
    expect(getToast("alert")).not.toBeNull();

    act(() => {
      backdrop.click();
    });
    expect(getToast("alert")).toBeNull();
  });

  it("keeps an error toast visible when it replaces a success toast mid-countdown", () => {
    const showToast = renderProvider();

    act(() => {
      showToast({ tone: "success", title: "Saved." });
    });
    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS - 1000);
    });
    act(() => {
      showToast({ tone: "error", title: "It failed." });
    });

    // The stale success timer must not dismiss the replacement error toast.
    act(() => {
      vi.advanceTimersByTime(AUTO_DISMISS_MS * 2);
    });

    expect(getToast("alert")?.textContent).toContain("It failed.");
    expect(getToast("status")).toBeNull();
  });
});

describe("useChairActionToast outside a provider", () => {
  it("returns a no-op showToast that does not throw", () => {
    let showToast: ((notice: ChairNotice) => void) | undefined;

    function Capture() {
      showToast = useChairActionToast().showToast;
      return null;
    }

    act(() => {
      root.render(<Capture />);
    });

    expect(() =>
      showToast?.({ tone: "success", title: "Saved." }),
    ).not.toThrow();
  });
});
