// @vitest-environment jsdom

import { MarketplaceStorefront } from "@/app/marketplace/MarketplaceStorefront";
import type { MarketplaceCatalogListing } from "@/lib/marketplaceCatalog";
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
vi.mock("@/app/marketplace/marketplace.module.css", () => ({
  default: createStyleProxy(),
}));
vi.mock("@/components/ModularCard.module.css", () => ({
  default: createStyleProxy(),
}));
vi.mock("@/components/DraftNotice.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("lucide-react", () => ({
  CreditCard: () => createElement("svg", { "data-slot": "credit-card-icon" }),
  LoaderCircle: () => createElement("svg", { "data-slot": "loader-icon" }),
  Minus: () => createElement("svg", { "data-slot": "minus-icon" }),
  Plus: () => createElement("svg", { "data-slot": "plus-icon" }),
  ShoppingBag: () => createElement("svg", { "data-slot": "bag-icon" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Checkout-blocking errors surface through the shared toast context; only the
// informational "review" notice remains inline.
vi.mock("@/components/notices/ActionToast", () => ({
  useActionToast: () => ({ showToast }),
  ActionToastProvider: ({ children }: { children: unknown }) => children,
}));

// The draft hook owns localStorage; the form's contract is only when it asks
// the hook to clear, so the hook is doubled rather than storage simulated.
vi.mock("@/lib/useFormDraft", () => ({
  useControlledFormDraft: () => ({ wasRestored: false, clearDraft }),
}));

const CHECKOUT_ERROR_TITLE = "Marketplace checkout did not start.";

function createListing(): MarketplaceCatalogListing {
  return {
    id: "listing-hoodie",
    slug: "hoodie",
    title: "Blarney Hoodie",
    description: "Heavyweight fleece for the tournament weekend.",
    imageUrl: "/images/hoodie.jpg",
    fulfillmentNote: "Pickup at check-in.",
    sortOrder: 0,
    variants: [
      {
        id: "variant-hoodie-m",
        label: "Medium",
        sku: "HOODIE-M",
        unitAmount: 4500,
        currency: "USD",
        inventoryQuantity: 8,
      },
    ],
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

async function mount(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(MarketplaceStorefront, { listings: [createListing()] }),
    );
  });
}

async function addItemToCart(): Promise<void> {
  const increase = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Increase Blarney Hoodie Medium"]',
  );
  if (!increase) {
    throw new Error("increase button not rendered");
  }
  await act(async () => {
    increase.click();
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

function quantityInputValue(): string {
  const quantityInput = container.querySelector<HTMLInputElement>(
    "#marketplace-quantity-listing-hoodie",
  );
  if (!quantityInput) {
    throw new Error("quantity input not rendered");
  }
  return quantityInput.value;
}

function stubCheckoutFetch(payload: unknown) {
  const fetchMock = vi.fn(async () => ({ json: async () => payload }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MarketplaceStorefront toast error contract", () => {
  it("toasts the empty-cart guard without calling the checkout API", async () => {
    const fetchMock = stubCheckoutFetch({});

    await mount();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: CHECKOUT_ERROR_TITLE,
      body: "Add at least one marketplace item before continuing to checkout.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts when the checkout response fails to parse, preserving the cart", async () => {
    stubCheckoutFetch({ unexpected: true });

    await mount();
    await addItemToCart();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: CHECKOUT_ERROR_TITLE,
      body: "Marketplace checkout could not be started. Please try again.",
    });
    expect(push).not.toHaveBeenCalled();
    expect(clearDraft).not.toHaveBeenCalled();
    // The cart and the submit button survive the failure.
    expect(quantityInputValue()).toBe("1");
    expect(submitButton().disabled).toBe(false);
  });

  it("toasts when the pending payment URL is not a trusted Square host", async () => {
    stubCheckoutFetch({
      ok: true,
      status: "pending",
      checkoutId: "chk_1",
      paymentUrl: "https://not-square.example.com/pay",
    });

    await mount();
    await addItemToCart();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: CHECKOUT_ERROR_TITLE,
      body: "Marketplace checkout is temporarily unavailable. Please try again.",
    });
    expect(clearDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(quantityInputValue()).toBe("1");
  });

  it("toasts when items are no longer available", async () => {
    stubCheckoutFetch({ ok: false, status: "unavailable_items" });

    await mount();
    await addItemToCart();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: CHECKOUT_ERROR_TITLE,
      body: "One or more selected items are no longer available in the requested quantities. Review the catalog and try again.",
    });
    expect(clearDraft).not.toHaveBeenCalled();
    expect(quantityInputValue()).toBe("1");
  });

  it("toasts the catch-all copy when the checkout request throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down detail");
    });
    vi.stubGlobal("fetch", fetchMock);

    await mount();
    await addItemToCart();
    await submitForm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      tone: "error",
      title: CHECKOUT_ERROR_TITLE,
      body: "Marketplace checkout is temporarily unavailable. Please try again.",
    });
    // error.message must never leak into the toast.
    expect(JSON.stringify(showToast.mock.calls)).not.toContain(
      "network down detail",
    );
    expect(submitButton().disabled).toBe(false);
  });

  it("clears the draft and navigates to the thanks page on a confirmed checkout without toasting", async () => {
    stubCheckoutFetch({ ok: true, status: "confirmed", orderId: "order-77" });

    await mount();
    await addItemToCart();
    await submitForm();

    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/marketplace/thanks?order=order-77");
    expect(showToast).not.toHaveBeenCalled();
  });
});
