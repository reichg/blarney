// @vitest-environment jsdom

// The chair suites cover the factory-built behavior exhaustively through the
// chair bindings. This suite only proves the shared core's public surface:
// the DEFAULT useActionNavigation and NoticeFromQuery exports are bound to
// useActionToast, so toasts land in the directly imported ActionToastProvider.

import { ActionToastProvider } from "@/components/notices/ActionToast";
import { NoticeFromQuery } from "@/components/notices/NoticeFromQuery";
import type {
  ActionNoticeMap,
  NoticeFormAction,
} from "@/components/notices/type";
import { useActionNavigation } from "@/components/notices/useActionNavigation";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navState, replace } = vi.hoisted(() => ({
  replace: vi.fn(),
  // Mutable so each test can stage the URL the query reader sees on mount.
  navState: { pathname: "/feedback", search: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/components/notices/notices.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

const NOTICE_PARAM = "notice";

const NOTICES: ActionNoticeMap = {
  saved: { tone: "success", title: "Saved." },
  failed: { tone: "error", title: "It failed." },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  navState.pathname = "/feedback";
  navState.search = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function getToast(role: "status" | "alert") {
  return container.querySelector(`[role="${role}"]`);
}

// Mounts the default hook under the real provider so a surfaced toast renders
// into the DOM through the shared context rather than a mocked toast module.
function captureRunActionUnderProvider(): ReturnType<
  typeof useActionNavigation
> {
  let runAction: ReturnType<typeof useActionNavigation> | undefined;

  function Harness() {
    runAction = useActionNavigation(NOTICE_PARAM, NOTICES);
    return null;
  }

  act(() => {
    root.render(
      <ActionToastProvider>
        <Harness />
      </ActionToastProvider>,
    );
  });

  if (!runAction) {
    throw new Error("useActionNavigation did not return a runner");
  }

  return runAction;
}

describe("useActionNavigation default binding", () => {
  it("surfaces an error notice as role=alert in the shared provider without navigating", async () => {
    const action = vi.fn<NoticeFormAction>(async () => ({
      redirectTo: "/feedback?notice=failed",
    }));

    const runAction = captureRunActionUnderProvider();
    await act(async () => {
      await runAction(action)(new FormData());
    });

    expect(getToast("alert")?.textContent).toContain("It failed.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces a success notice as role=status and still navigates", async () => {
    const action = vi.fn<NoticeFormAction>(async () => ({
      redirectTo: "/feedback?notice=saved",
    }));

    const runAction = captureRunActionUnderProvider();
    await act(async () => {
      await runAction(action)(new FormData());
    });

    expect(getToast("status")?.textContent).toContain("Saved.");
    expect(replace).toHaveBeenCalledWith("/feedback?notice=saved", {
      scroll: false,
    });
  });
});

describe("NoticeFromQuery default binding", () => {
  it("toasts a known code through the shared provider and strips the notice param", async () => {
    navState.search = "notice=saved";

    await act(async () => {
      root.render(
        <ActionToastProvider>
          <NoticeFromQuery notices={NOTICES} param={NOTICE_PARAM} />
        </ActionToastProvider>,
      );
    });

    expect(getToast("status")?.textContent).toContain("Saved.");
    expect(replace).toHaveBeenCalledWith("/feedback", { scroll: false });
  });
});
