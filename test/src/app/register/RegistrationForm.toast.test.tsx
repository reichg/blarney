// @vitest-environment jsdom

import { RegistrationForm } from "@/app/register/RegistrationForm";
import type { RegistrationFormProps } from "@/app/register/type";
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

const { clearDraft, push, showToast } = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  push: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/app/forms.module.css", () => ({ default: createStyleProxy() }));
vi.mock("@/components/DraftNotice.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("lucide-react", () => ({
  CreditCard: () => createElement("svg", { "data-slot": "credit-card-icon" }),
  Flag: () => createElement("svg", { "data-slot": "flag-icon" }),
  Plus: () => createElement("svg", { "data-slot": "plus-icon" }),
  Trash2: () => createElement("svg", { "data-slot": "trash-icon" }),
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
  useControlledFormDraft: () => ({ wasRestored: false, clearDraft }),
}));

function createProps(
  overrides: Partial<RegistrationFormProps> = {},
): RegistrationFormProps {
  return {
    currency: "USD",
    defaultPackageSelection: "REGISTER_GOLF",
    golfPriceCents: 15000,
    golfPriceLabel: "$150.00",
    adultGuestPriceCents: 2500,
    adultGuestPriceLabel: "$25.00",
    childGuestPriceCents: 1200,
    childGuestPriceLabel: "$12.00",
    submitRegistrationAction: vi.fn<
      RegistrationFormProps["submitRegistrationAction"]
    >(async () => ({
      ok: false,
      error: "unused",
    })),
    submitRsvpAction: vi.fn<RegistrationFormProps["submitRsvpAction"]>(
      async () => ({
        ok: false,
        reason: "invalid",
        error: "unused",
      }),
    ),
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
  vi.clearAllMocks();
});

async function mount(props: RegistrationFormProps): Promise<void> {
  await act(async () => {
    root.render(createElement(RegistrationForm, props));
  });
}

function input(selector: string): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>(selector);
  if (!element) {
    throw new Error(`input ${selector} not found`);
  }
  return element;
}

// Drives a controlled input through React's onChange (native setter + input
// event), so the component state really updates.
async function setInputValue(selector: string, value: string): Promise<void> {
  const element = input(selector);
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseBbqMode(): Promise<void> {
  const radio = input('input[name="signupMode"][value="bbq"]');
  await act(async () => {
    radio.click();
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

describe("RegistrationForm toast error contract", () => {
  it("toasts the action error when a golf registration fails, preserving form state", async () => {
    const submitRegistrationAction = vi.fn<
      RegistrationFormProps["submitRegistrationAction"]
    >(async () => ({
      ok: false,
      error: "Registration window is closed.",
    }));

    await mount(createProps({ submitRegistrationAction }));
    await setInputValue('input[name="firstName"]', "Pat");
    await submitForm();

    expect(submitRegistrationAction).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Registration was not submitted.",
      body: "Registration window is closed.",
    });
    expect(push).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
    // Submit is re-enabled and the typed state survives the failure.
    expect(submitButton().disabled).toBe(false);
    expect(input('input[name="firstName"]').value).toBe("Pat");
  });

  it("toasts the zero-attendee guard before calling the RSVP action", async () => {
    const props = createProps();

    await mount(props);
    await chooseBbqMode();
    await setInputValue('input[name="adultAttendeeCount"]', "0");
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "RSVP was not submitted.",
      body: "Add at least one BBQ attendee before continuing to payment.",
    });
    expect(props.submitRsvpAction).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts the action error when an RSVP fails", async () => {
    const submitRsvpAction = vi.fn<RegistrationFormProps["submitRsvpAction"]>(
      async () => ({
        ok: false,
        reason: "duplicate",
        error: "This email already has a BBQ RSVP.",
      }),
    );

    await mount(createProps({ submitRsvpAction }));
    await chooseBbqMode();
    await submitForm();

    expect(submitRsvpAction).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "RSVP was not submitted.",
      body: "This email already has a BBQ RSVP.",
    });
    expect(push).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts the signup-type guard when no mode is selected", async () => {
    const props = createProps();

    await mount(props);
    // Uncheck both radios at the DOM level so FormData carries no signupMode.
    for (const radio of container.querySelectorAll<HTMLInputElement>(
      'input[name="signupMode"]',
    )) {
      radio.checked = false;
    }
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Signup type is required.",
      body: "Choose golf registration or BBQ-only RSVP.",
    });
    expect(props.submitRegistrationAction).not.toHaveBeenCalled();
    expect(props.submitRsvpAction).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts the static catch-all copy when the golf action throws", async () => {
    const submitRegistrationAction = vi.fn<
      RegistrationFormProps["submitRegistrationAction"]
    >(async () => {
      throw new Error("network blip detail");
    });

    await mount(createProps({ submitRegistrationAction }));
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Submission failed.",
      body: "Registration could not be submitted. Please try again.",
    });
    // error.message must never leak into the toast.
    expect(JSON.stringify(showToast.mock.calls)).not.toContain(
      "network blip detail",
    );
    expect(push).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("clears the draft and navigates on a no-payment RSVP success without toasting", async () => {
    const submitRsvpAction = vi.fn<RegistrationFormProps["submitRsvpAction"]>(
      async () => ({
        ok: true,
        requiresPayment: false,
        thanksPath: "/register/thanks?rsvp=confirmed",
      }),
    );

    await mount(createProps({ submitRsvpAction }));
    await chooseBbqMode();
    await submitForm();

    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/register/thanks?rsvp=confirmed");
    expect(showToast).not.toHaveBeenCalled();
  });
});
