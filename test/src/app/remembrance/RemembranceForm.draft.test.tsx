// @vitest-environment jsdom

import { RemembranceForm } from "@/app/remembrance/RemembranceForm";
import { DRAFT_KEY_PREFIX, saveFormDraft } from "@/lib/formDraft";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

vi.mock("@/app/forms.module.css", () => ({ default: createStyleProxy() }));
vi.mock("@/app/remembrance/remembrance.module.css", () => ({
  default: createStyleProxy(),
}));
vi.mock("@/components/DraftNotice.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/PhotoBrowsePicker", () => ({
  PhotoBrowsePicker: () =>
    createElement("div", { "data-slot": "photo-picker" }, "Photo picker"),
  getSelectedPhotoFiles: () => [],
}));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const REMEMBRANCE_KEY = `${DRAFT_KEY_PREFIX}remembrance`;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

async function mount(): Promise<void> {
  await act(async () => {
    root.render(createElement(RemembranceForm));
  });
  // The uncontrolled hook flips wasRestored inside a queueMicrotask; an async act
  // drains that microtask and flushes the resulting React re-render.
  await act(async () => {
    await Promise.resolve();
  });
}

function field(name: string): HTMLInputElement | HTMLTextAreaElement {
  const element = container.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >(`[name="${name}"]`);
  if (!element) {
    throw new Error(`field ${name} not found`);
  }
  return element;
}

describe("RemembranceForm draft persistence", () => {
  it("restores a stored draft into the form fields and shows the restore notice", async () => {
    saveFormDraft("remembrance", 1, {
      message: "A memory worth keeping.",
      name: "Pat Golfer",
      email: "pat@example.com",
    });

    await mount();

    expect(field("message").value).toBe("A memory worth keeping.");
    expect(field("name").value).toBe("Pat Golfer");
    expect(field("email").value).toBe("pat@example.com");
    expect(container.textContent).toContain(
      "We restored your unsaved entries from earlier.",
    );
  });

  it("clears the stored draft after a successful submit", async () => {
    saveFormDraft("remembrance", 1, {
      message: "A memory worth keeping.",
      name: "Pat Golfer",
      email: "pat@example.com",
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ feedbackId: "feedback-123" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await mount();
    expect(window.sessionStorage.getItem(REMEMBRANCE_KEY)).not.toBeNull();

    const form = container.querySelector("form");
    if (!form) {
      throw new Error("form not rendered");
    }

    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/remembrance",
      expect.objectContaining({ method: "POST" }),
    );
    expect(window.sessionStorage.getItem(REMEMBRANCE_KEY)).toBeNull();
    expect(push).toHaveBeenCalledWith("/remembrance/thanks");
  });
});
