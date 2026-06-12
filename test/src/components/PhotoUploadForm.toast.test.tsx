// @vitest-environment jsdom

import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { photoUploadLimitLabel } from "@/lib/photoUpload";
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
vi.mock("@/components/PhotoUploadForm.module.css", () => ({
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

vi.mock("lucide-react", () => ({
  Upload: () => createElement("svg", { "data-slot": "upload-icon" }),
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
// stands in for a File without allocating oversized buffers.
function fakePhoto(
  overrides: Partial<Pick<File, "name" | "type" | "size">> = {},
): File {
  return {
    name: "round-one.jpg",
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
});

async function mount(): Promise<void> {
  await act(async () => {
    root.render(createElement(PhotoUploadForm));
  });
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

function statusText(): string {
  return container.querySelector(".status")?.textContent ?? "";
}

describe("PhotoUploadForm toast error contract", () => {
  it("toasts when no photos are selected and leaves the form usable", async () => {
    await mount();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Choose at least one photo to submit.",
      body: undefined,
    });
    expect(uploadPhotoWithPresign).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
    expect(statusText()).toBe("");
  });

  it("toasts static copy without the file name for an unsupported type", async () => {
    getSelectedPhotoFiles.mockReturnValue([
      fakePhoto({ name: "family-reunion.heic", type: "image/heic" }),
    ]);

    await mount();
    await submitForm();

    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "One of the selected files is not a supported image.",
      body: `Use ${acceptedPhotoTypeLabel}, then try again.`,
    });
    // The old inline copy interpolated the file name; the toast must not.
    expect(JSON.stringify(showToast.mock.calls)).not.toContain("family-reunion");
    expect(uploadPhotoWithPresign).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts static copy without the file name for an oversized photo", async () => {
    getSelectedPhotoFiles.mockReturnValue([
      fakePhoto({ name: "panorama.jpg", size: Number.MAX_SAFE_INTEGER }),
    ]);

    await mount();
    await submitForm();

    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "One of the selected photos is too large.",
      body: `Photos must be ${photoUploadLimitLabel} or smaller.`,
    });
    expect(JSON.stringify(showToast.mock.calls)).not.toContain("panorama");
    expect(uploadPhotoWithPresign).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("toasts static copy without error detail when an upload fails, keeping the form usable", async () => {
    getSelectedPhotoFiles.mockReturnValue([fakePhoto()]);
    uploadPhotoWithPresign.mockRejectedValue(
      new Error("presign exploded: internal S3 detail"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await mount();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Photo upload did not finish.",
      body: "Your entries are still in the form. Check your connection and try again.",
    });
    // error.message must never leak into the toast.
    expect(JSON.stringify(showToast.mock.calls)).not.toContain(
      "internal S3 detail",
    );
    expect(push).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
    expect(statusText()).toBe("");
  });

  it("clears the draft and navigates to the thanks page on success without toasting", async () => {
    getSelectedPhotoFiles.mockReturnValue([fakePhoto()]);

    await mount();
    await submitForm();

    expect(uploadPhotoWithPresign).toHaveBeenCalledTimes(1);
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/photos/thanks");
    expect(showToast).not.toHaveBeenCalled();
  });
});
