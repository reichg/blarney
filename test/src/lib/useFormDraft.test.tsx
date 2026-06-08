// @vitest-environment jsdom

import { DRAFT_KEY_PREFIX, saveFormDraft } from "@/lib/formDraft";
import {
  DRAFT_SAVE_DEBOUNCE_MS,
  useControlledFormDraft,
  useUncontrolledFormDraft,
  type FormDraftHandle,
  type UncontrolledFormDraftHandle,
} from "@/lib/useFormDraft";
import {
  act,
  createElement,
  createRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FORM_ID = "draft-hook";
const FORM_VERSION = 1;
const KEY = `${DRAFT_KEY_PREFIX}${FORM_ID}`;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
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

async function render(node: ReactNode): Promise<void> {
  await act(async () => {
    root.render(node);
  });
  // The mount restore applies state inside a queueMicrotask; an async act drains
  // that microtask and flushes the resulting React update. queueMicrotask is not
  // faked by vitest's fake timers, so awaiting a resolved promise is sufficient.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useControlledFormDraft", () => {
  it("restores a stored draft on mount and reports wasRestored", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "restored@example.com" });

    const onRestore = vi.fn();
    let handle: FormDraftHandle | undefined;

    function Harness() {
      const [value] = useState({ email: "" });
      handle = useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore,
      });
      return null;
    }

    await render(createElement(Harness));

    expect(onRestore).toHaveBeenCalledWith({ email: "restored@example.com" });
    expect(handle?.wasRestored).toBe(true);
  });

  it("hides the notice and removes the draft when clearDraft is called", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "restored@example.com" });

    let handle: FormDraftHandle | undefined;

    function Harness() {
      const [value] = useState({ email: "" });
      handle = useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore: () => undefined,
      });
      return null;
    }

    await render(createElement(Harness));
    expect(handle?.wasRestored).toBe(true);

    await act(async () => {
      handle?.clearDraft();
    });

    expect(handle?.wasRestored).toBe(false);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("does not restore when no draft exists", async () => {
    const onRestore = vi.fn();

    function Harness() {
      const [value] = useState({ email: "" });
      useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore,
      });
      return null;
    }

    await render(createElement(Harness));

    expect(onRestore).not.toHaveBeenCalled();
  });

  it("saves the controlled value after the debounce window elapses", async () => {
    function Harness() {
      const [value, setValue] = useState({ email: "" });
      useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore: () => undefined,
      });
      useEffect(() => {
        setValue({ email: "typed@example.com" });
      }, []);
      return null;
    }

    await render(createElement(Harness));

    // Nothing is written until the debounce timer fires.
    expect(window.sessionStorage.getItem(KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS);
    });

    const stored = JSON.parse(window.sessionStorage.getItem(KEY) as string);
    expect(stored.data).toEqual({ email: "typed@example.com" });
  });

  it("clears the draft via the returned handle", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "x@example.com" });

    let handle: FormDraftHandle | undefined;

    function Harness() {
      const [value] = useState({ email: "" });
      handle = useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore: () => undefined,
      });
      return null;
    }

    await render(createElement(Harness));
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull();

    act(() => {
      handle?.clearDraft();
    });

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("does not save when disabled", async () => {
    function Harness() {
      const [value, setValue] = useState({ email: "" });
      useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore: () => undefined,
        enabled: false,
      });
      useEffect(() => {
        setValue({ email: "typed@example.com" });
      }, []);
      return null;
    }

    await render(createElement(Harness));
    act(() => {
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS * 2);
    });

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("does not restore and discards the draft when hasContent rejects it", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "" });

    const onRestore = vi.fn();
    let handle: FormDraftHandle | undefined;

    function Harness() {
      const [value] = useState({ email: "" });
      handle = useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore,
        hasContent: (v) => v.email.trim().length > 0,
      });
      return null;
    }

    await render(createElement(Harness));

    expect(onRestore).not.toHaveBeenCalled();
    expect(handle?.wasRestored).toBe(false);
    // The meaningless draft is self-healed away on mount.
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("restores and reports wasRestored when hasContent accepts the draft", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "kept@example.com" });

    const onRestore = vi.fn();
    let handle: FormDraftHandle | undefined;

    function Harness() {
      const [value] = useState({ email: "" });
      handle = useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore,
        hasContent: (v) => v.email.trim().length > 0,
      });
      return null;
    }

    await render(createElement(Harness));

    expect(onRestore).toHaveBeenCalledWith({ email: "kept@example.com" });
    expect(handle?.wasRestored).toBe(true);
  });

  it("clears storage instead of saving when hasContent rejects the value", async () => {
    function Harness() {
      const [value] = useState({ email: "   " });
      useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore: () => undefined,
        hasContent: (v) => v.email.trim().length > 0,
      });
      return null;
    }

    await render(createElement(Harness));

    // Seed a stale draft AFTER mount restore so the debounced empty save is what
    // clears it (the value "   " fails hasContent, so the save path clears).
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "stale@example.com" });
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS);
    });

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("writes the draft when hasContent accepts the value", async () => {
    function Harness() {
      const [value, setValue] = useState({ email: "" });
      useControlledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        value,
        onRestore: () => undefined,
        hasContent: (v) => v.email.trim().length > 0,
      });
      useEffect(() => {
        setValue({ email: "typed@example.com" });
      }, []);
      return null;
    }

    await render(createElement(Harness));

    act(() => {
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS);
    });

    const stored = JSON.parse(window.sessionStorage.getItem(KEY) as string);
    expect(stored.data).toEqual({ email: "typed@example.com" });
  });
});

describe("useUncontrolledFormDraft", () => {
  it("serializes persistable fields on change, excluding sensitive and file inputs", async () => {
    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
      });
      return createElement(
        "form",
        { ref: formRef },
        createElement("input", {
          name: "email",
          defaultValue: "buyer@example.com",
          readOnly: true,
        }),
        createElement("input", {
          name: "__chairToken",
          defaultValue: "secret-token",
          readOnly: true,
        }),
        createElement("input", {
          name: "attachment",
          type: "file",
        }),
      );
    }

    await render(createElement(Harness));

    act(() => {
      handle?.handleChange();
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS);
    });

    const stored = JSON.parse(window.sessionStorage.getItem(KEY) as string);
    expect(stored.data).toEqual({ email: "buyer@example.com" });
    expect(stored.data).not.toHaveProperty("__chairToken");
    expect(stored.data).not.toHaveProperty("attachment");
  });

  it("restores stored DOM values into the form on mount", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "restored@example.com" });

    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
      });
      return createElement(
        "form",
        { ref: formRef },
        createElement("input", { name: "email", defaultValue: "" }),
      );
    }

    await render(createElement(Harness));

    const field = container.querySelector<HTMLInputElement>(
      'input[name="email"]',
    );
    expect(field?.value).toBe("restored@example.com");
    expect(handle?.wasRestored).toBe(true);
  });

  it("hides the notice and removes the draft when clearDraft is called", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "restored@example.com" });

    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
      });
      return createElement(
        "form",
        { ref: formRef },
        createElement("input", { name: "email", defaultValue: "" }),
      );
    }

    await render(createElement(Harness));
    expect(handle?.wasRestored).toBe(true);

    await act(async () => {
      handle?.clearDraft();
    });

    expect(handle?.wasRestored).toBe(false);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("honors the excludeFields option", async () => {
    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
        excludeFields: ["email"],
      });
      return createElement(
        "form",
        { ref: formRef },
        createElement("input", {
          name: "email",
          defaultValue: "buyer@example.com",
          readOnly: true,
        }),
        createElement("input", {
          name: "name",
          defaultValue: "Pat",
          readOnly: true,
        }),
      );
    }

    await render(createElement(Harness));

    act(() => {
      handle?.handleChange();
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS);
    });

    const stored = JSON.parse(window.sessionStorage.getItem(KEY) as string);
    expect(stored.data).toEqual({ name: "Pat" });
  });

  it("reports wasRestored when at least one field is restored", async () => {
    saveFormDraft(FORM_ID, FORM_VERSION, {
      email: "restored@example.com",
      missing: "ignored",
    });

    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
      });
      return createElement(
        "form",
        { ref: formRef },
        createElement("input", { name: "email", defaultValue: "" }),
      );
    }

    await render(createElement(Harness));

    const field = container.querySelector<HTMLInputElement>(
      'input[name="email"]',
    );
    expect(field?.value).toBe("restored@example.com");
    expect(handle?.wasRestored).toBe(true);
  });

  it("does not report wasRestored and clears the draft when nothing maps onto current fields", async () => {
    // Stored field name has no matching control in the rendered form.
    saveFormDraft(FORM_ID, FORM_VERSION, { phone: "555-0100" });

    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
      });
      return createElement(
        "form",
        { ref: formRef },
        createElement("input", { name: "email", defaultValue: "" }),
      );
    }

    await render(createElement(Harness));

    expect(handle?.wasRestored).toBe(false);
    // Draft that restored nothing is discarded so it cannot linger.
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("clears the draft instead of saving when the form serializes to empty", async () => {
    const formRef = createRef<HTMLFormElement>();
    let handle: UncontrolledFormDraftHandle | undefined;

    function Harness() {
      handle = useUncontrolledFormDraft({
        formId: FORM_ID,
        formVersion: FORM_VERSION,
        formRef,
      });
      return createElement(
        "form",
        { ref: formRef },
        // Empty value -> excluded by the serializer -> serializes to {}.
        createElement("input", { name: "email", defaultValue: "" }),
      );
    }

    await render(createElement(Harness));

    // Seed a stale draft AFTER mount restore has run, so it is not consumed by
    // the restore pass. A change on the now-empty form must clear it.
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "stale@example.com" });
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull();

    act(() => {
      handle?.handleChange();
      vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS);
    });

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});
