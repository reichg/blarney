// @vitest-environment jsdom

import { MobileNavigation } from "@/components/MobileNavigation";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

vi.mock("@/components/Navigation.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("lucide-react", () => ({
  Menu: (props: Record<string, unknown>) => createElement("svg", props),
  X: (props: Record<string, unknown>) => createElement("svg", props),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: ReactNode;
    href: string;
    onClick?: (event: MouseEvent) => void;
  }) => createElement("a", { href, onClick, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

const links = [
  { href: "/photos", label: "Photos" },
  { href: "/marketplace", label: "Marketplace" },
];

let container: HTMLDivElement;
let root: Root;
let currentPathname = "/photos";
let scrollToMock: ReturnType<typeof vi.fn>;

function renderMobileNavigation() {
  act(() => {
    root.render(<MobileNavigation links={links} />);
  });
}

function rerenderMobileNavigation(pathname: string) {
  currentPathname = pathname;

  renderMobileNavigation();
}

function clickElement(selector: string) {
  const element = container.querySelector(selector);

  expect(element).not.toBeNull();

  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function ctrlClickElement(selector: string) {
  const element = container.querySelector(selector);

  expect(element).not.toBeNull();

  act(() => {
    element?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, ctrlKey: true }),
    );
  });
}

beforeEach(() => {
  currentPathname = "/photos";
  usePathname.mockImplementation(() => currentPathname);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  scrollToMock = vi.fn();

  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: scrollToMock,
    writable: true,
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("MobileNavigation", () => {
  it("scrolls to the top when navigating to a different page", () => {
    renderMobileNavigation();

    clickElement('button[aria-label="Open navigation"]');
    clickElement('a[href="/marketplace"]');

    expect(scrollToMock).not.toHaveBeenCalled();

    rerenderMobileNavigation("/marketplace");

    expect(scrollToMock).toHaveBeenCalledOnce();
    expect(scrollToMock).toHaveBeenCalledWith({
      behavior: "auto",
      left: 0,
      top: 0,
    });
    expect(
      container.querySelector('nav[aria-label="Mobile navigation"]'),
    ).toBeNull();
  });

  it("does not scroll when selecting the current page", () => {
    renderMobileNavigation();

    clickElement('button[aria-label="Open navigation"]');
    clickElement('a[href="/photos"]');

    expect(scrollToMock).not.toHaveBeenCalled();
    expect(
      container.querySelector('nav[aria-label="Mobile navigation"]'),
    ).toBeNull();
  });

  it("does not scroll for modified clicks that keep the current tab in place", () => {
    renderMobileNavigation();

    clickElement('button[aria-label="Open navigation"]');
    ctrlClickElement('a[href="/marketplace"]');

    expect(scrollToMock).not.toHaveBeenCalled();

    rerenderMobileNavigation("/marketplace");

    expect(scrollToMock).not.toHaveBeenCalled();
    expect(
      container.querySelector('nav[aria-label="Mobile navigation"]'),
    ).toBeNull();
  });
});
