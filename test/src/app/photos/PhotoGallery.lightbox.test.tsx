// @vitest-environment jsdom

import { PhotoGallery } from "@/app/photos/PhotoGallery";
import { act, createElement, type ElementType, type ReactNode } from "react";
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

vi.mock("@/app/photos/photos.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/components/ModularCard", () => ({
  ModularCard: ({
    as,
    children,
    className,
  }: {
    as?: ElementType;
    children: ReactNode;
    className?: string;
  }) => {
    const Component = as ?? "article";

    return createElement(Component, { className }, children);
  },
}));

const photos = [
  { id: "photo-1", caption: "First caption" },
  { id: "photo-2", caption: null },
];

let container: HTMLDivElement;
let root: Root;

function renderGallery() {
  act(() => {
    root.render(<PhotoGallery photos={photos} />);
  });
}

function clickElement(element: Element | null) {
  expect(element).not.toBeNull();

  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function openLightbox() {
  clickElement(container.querySelector('button[aria-haspopup="dialog"]'));
}

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
});

describe("PhotoGallery lightbox", () => {
  it("portals the open dialog to document.body, outside the gallery tree", () => {
    renderGallery();

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    openLightbox();

    const dialog = document.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    // Portal contract: mounted directly under <body> so the panel's hover
    // transform can never become the fixed overlay's containing block.
    expect(dialog?.parentElement).toBe(document.body);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes via the close button and restores body scroll", () => {
    renderGallery();
    openLightbox();

    clickElement(
      document.querySelector('button[aria-label="Close full-size photo"]'),
    );

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when Escape is pressed", () => {
    renderGallery();
    openLightbox();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
