import type {
  ChairFormAction,
  ChairNoticeMap,
} from "@/app/chair/notices/type";
import { useChairActionNavigation } from "@/app/chair/notices/useChairActionNavigation";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace, showToast } = vi.hoisted(() => ({
  replace: vi.fn(),
  showToast: vi.fn(),
}));

// The hook navigates via the router instead of a server-side redirect(), so
// chair pages keep their scroll position after an action.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

// Error notices are surfaced through the toast context rather than navigation.
vi.mock("@/app/chair/notices/ChairActionToast", () => ({
  useChairActionToast: () => ({ showToast }),
  ChairActionToastProvider: ({ children }: { children: unknown }) => children,
}));

const NOTICE_PARAM = "notice";

const NOTICES: ChairNoticeMap = {
  saved: { tone: "success", title: "Saved." },
  failed: { tone: "error", title: "It failed." },
};

afterEach(() => {
  vi.clearAllMocks();
});

// Renders a component that consumes useChairActionNavigation under a React
// render so the hook binds the mocked router, then hands the bound runner back
// so the test can invoke the function React would assign to form.action.
function captureRunChairAction(): ReturnType<typeof useChairActionNavigation> {
  let runChairAction: ReturnType<typeof useChairActionNavigation> | undefined;

  function Harness() {
    runChairAction = useChairActionNavigation(NOTICE_PARAM, NOTICES);
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!runChairAction) {
    throw new Error("useChairActionNavigation did not return a runner");
  }

  return runChairAction;
}

describe("useChairActionNavigation", () => {
  it("toasts a success notice, runs onResult before navigating, and preserves scroll", async () => {
    const calls: string[] = [];
    const onResult = vi.fn(() => {
      calls.push("onResult");
    });
    replace.mockImplementation(() => {
      calls.push("replace");
    });

    const action = vi.fn<ChairFormAction>(async () => ({
      redirectTo: "/chair/photos?notice=saved",
    }));

    const runChairAction = captureRunChairAction();
    await runChairAction(action, { onResult })(new FormData());

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success", title: "Saved." }),
    );
    expect(replace).toHaveBeenCalledWith("/chair/photos?notice=saved", {
      scroll: false,
    });
    expect(calls).toEqual(["onResult", "replace"]);
  });

  it("toasts an error notice without navigating or calling onResult, but still settles", async () => {
    const onResult = vi.fn();
    const onSettled = vi.fn();
    const action = vi.fn<ChairFormAction>(async () => ({
      redirectTo: "/chair/photos?notice=failed",
    }));

    const runChairAction = captureRunChairAction();
    await runChairAction(action, { onResult, onSettled })(new FormData());

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "error", title: "It failed." }),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does nothing but settle when the action returns no redirect", async () => {
    const onResult = vi.fn();
    const onSettled = vi.fn();
    const action = vi.fn<ChairFormAction>(async () => undefined);

    const runChairAction = captureRunChairAction();
    await runChairAction(action, { onResult, onSettled })(new FormData());

    expect(showToast).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("navigates without a toast when the notice code is unknown", async () => {
    const action = vi.fn<ChairFormAction>(async () => ({
      redirectTo: "/chair/photos?notice=unknown-code",
    }));

    const runChairAction = captureRunChairAction();
    await runChairAction(action)(new FormData());

    expect(showToast).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/chair/photos?notice=unknown-code", {
      scroll: false,
    });
  });

  it.each(["__proto__", "constructor"])(
    "never resolves the inherited %s key to a toast, but still navigates",
    async (code) => {
      const action = vi.fn<ChairFormAction>(async () => ({
        redirectTo: `/chair/photos?notice=${code}`,
      }));

      const runChairAction = captureRunChairAction();
      await runChairAction(action)(new FormData());

      expect(showToast).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith(`/chair/photos?notice=${code}`, {
        scroll: false,
      });
    },
  );

  it("navigates without a toast when the redirect has no query string", async () => {
    const action = vi.fn<ChairFormAction>(async () => ({
      redirectTo: "/chair/photos",
    }));

    const runChairAction = captureRunChairAction();
    await runChairAction(action)(new FormData());

    expect(showToast).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/chair/photos", { scroll: false });
  });
});
