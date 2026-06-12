// @vitest-environment jsdom

import { ChairNoticeFromQuery } from "@/app/chair/notices/ChairNoticeFromQuery";
import type { ChairNoticeMap } from "@/app/chair/notices/type";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navState, replace, showToast } = vi.hoisted(() => ({
  replace: vi.fn(),
  showToast: vi.fn(),
  // Mutable so each test can stage the URL the reader effect sees on mount.
  navState: { pathname: "/chair/photos", search: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/app/chair/notices/ChairActionToast", () => ({
  useChairActionToast: () => ({ showToast }),
}));

const NOTICE_PARAM = "photos";

const NOTICES: ChairNoticeMap = {
  approved: { tone: "success", title: "Photo approved." },
  "approve-error": { tone: "error", title: "Approval failed." },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  navState.pathname = "/chair/photos";
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

// Mounts the reader so its useEffect (toast + URL cleanup) runs under act.
async function renderNoticeFromQuery(): Promise<void> {
  await act(async () => {
    root.render(
      <ChairNoticeFromQuery notices={NOTICES} param={NOTICE_PARAM} />,
    );
  });
}

describe("ChairNoticeFromQuery", () => {
  it("toasts a known code and strips only the notice param, preserving the rest", async () => {
    navState.search = "tab=gallery&photos=approved&page=2";

    await renderNoticeFromQuery();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success", title: "Photo approved." }),
    );
    expect(replace).toHaveBeenCalledWith("/chair/photos?tab=gallery&page=2", {
      scroll: false,
    });
  });

  it("replaces to the bare pathname when the notice param was the only param", async () => {
    navState.search = "photos=approve-error";

    await renderNoticeFromQuery();

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "error", title: "Approval failed." }),
    );
    expect(replace).toHaveBeenCalledWith("/chair/photos", { scroll: false });
  });

  it("strips an unknown code without toasting so stale links cannot pin garbage", async () => {
    navState.search = "photos=not-a-real-code&tab=gallery";

    await renderNoticeFromQuery();

    expect(showToast).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/chair/photos?tab=gallery", {
      scroll: false,
    });
  });

  it.each(["__proto__", "constructor"])(
    "never resolves the inherited %s key to a toast, but still strips it",
    async (code) => {
      navState.search = `photos=${code}`;

      await renderNoticeFromQuery();

      expect(showToast).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("/chair/photos", { scroll: false });
    },
  );

  it("does nothing when no notice code is present", async () => {
    navState.search = "tab=gallery";

    await renderNoticeFromQuery();

    expect(showToast).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
