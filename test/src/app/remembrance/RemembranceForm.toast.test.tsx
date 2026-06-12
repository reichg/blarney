// @vitest-environment jsdom

import { RemembranceForm } from "@/app/remembrance/RemembranceForm";
import { acceptedPhotoTypeLabel } from "@/lib/photoUploadClient";
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

const {
  clearDraft,
  getSelectedPhotoFiles,
  handleChange,
  push,
  showToast,
  uploadPhotoWithPresign,
} = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  getSelectedPhotoFiles: vi.fn<() => File[]>(),
  handleChange: vi.fn(),
  push: vi.fn(),
  showToast: vi.fn(),
  uploadPhotoWithPresign: vi.fn<() => Promise<void>>(),
}));

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
  getSelectedPhotoFiles,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Submission-blocking errors surface through the shared toast context; the
// inline error markup was removed from the form.
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

// Keep the real static labels (asserted below) while doubling the network call.
vi.mock("@/lib/photoUploadClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photoUploadClient")>()),
  uploadPhotoWithPresign,
}));

// Only name/type/size are read before the (mocked) upload, so a plain object
// stands in for a File.
function fakePhoto(
  overrides: Partial<Pick<File, "name" | "type" | "size">> = {},
): File {
  return {
    name: "memorial.jpg",
    type: "image/jpeg",
    size: 2048,
    ...overrides,
  } as File;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  getSelectedPhotoFiles.mockReturnValue([]);
  uploadPhotoWithPresign.mockResolvedValue(undefined);
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(): Promise<void> {
  await act(async () => {
    root.render(createElement(RemembranceForm));
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

// The fields are uncontrolled, so FormData reads the DOM values directly.
function fillRequiredFields(): void {
  field("message").value = "A memory worth keeping.";
  field("name").value = "Pat Golfer";
  field("email").value = "pat@example.com";
}

async function submitForm(): Promise<void> {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("form not rendered");
  }
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function submitButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!button) {
    throw new Error("submit button not rendered");
  }
  return button;
}

function stubFetch(response: { ok: boolean; payload?: unknown }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok,
    json: async () => response.payload ?? {},
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("RemembranceForm toast error contract", () => {
  it("toasts when required fields are missing and leaves the form usable", async () => {
    const fetchMock = stubFetch({ ok: true });

    await mount();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Complete the remembrance message, name, and email before sending.",
      body: undefined,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts static copy without the file name for an unsupported photo type", async () => {
    const fetchMock = stubFetch({ ok: true });
    getSelectedPhotoFiles.mockReturnValue([
      fakePhoto({ name: "family-reunion.heic", type: "image/heic" }),
    ]);

    await mount();
    fillRequiredFields();
    await submitForm();

    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "One of the selected files is not a supported image.",
      body: `Use ${acceptedPhotoTypeLabel}, then try again.`,
    });
    // The old inline copy interpolated the file name; the toast must not.
    expect(JSON.stringify(showToast.mock.calls)).not.toContain("family-reunion");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("toasts static copy without the API error body when the save fails", async () => {
    stubFetch({ ok: false, payload: { message: "raw database failure detail" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await mount();
    fillRequiredFields();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Your remembrance was not sent.",
      body: "Your entries are still in the form. Check your connection and try again.",
    });
    // The response body is never parsed into the toast.
    expect(JSON.stringify(showToast.mock.calls)).not.toContain(
      "raw database failure detail",
    );
    expect(push).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("clears the draft and navigates to the thanks page on success without toasting", async () => {
    stubFetch({ ok: true, payload: { feedbackId: "feedback-123" } });

    await mount();
    fillRequiredFields();
    await submitForm();

    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/remembrance/thanks");
    expect(showToast).not.toHaveBeenCalled();
  });
});
