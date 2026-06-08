import { DraftNotice } from "@/components/DraftNotice";
import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/DraftNotice.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

type AnyProps = Record<string, unknown>;

/** Depth-first search for the first button whose visible label includes `text`. */
function findButton(node: ReactNode, text: string): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButton(child, text);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!isValidElement(node)) {
    return null;
  }

  const element = node as ReactElement<AnyProps>;

  if (element.type === "button") {
    const markup = renderToStaticMarkup(element);
    if (markup.includes(text)) {
      return element;
    }
  }

  let match: ReactElement | null = null;
  Children.forEach(element.props.children as ReactNode, (child) => {
    if (!match) {
      match = findButton(child, text);
    }
  });
  return match;
}

describe("DraftNotice", () => {
  it("renders nothing when not visible", () => {
    const tree = DraftNotice({ visible: false });
    expect(tree).toBeNull();
  });

  it("renders an assertive-but-polite status region with the default message", () => {
    const html = renderToStaticMarkup(
      createElement(DraftNotice, { visible: true }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("We restored your unsaved entries from earlier.");
  });

  it("renders a custom message when provided", () => {
    const html = renderToStaticMarkup(
      createElement(DraftNotice, {
        visible: true,
        message: "Restored your listing draft.",
      }),
    );

    expect(html).toContain("Restored your listing draft.");
  });

  it("omits the action area entirely when no callbacks are supplied", () => {
    const html = renderToStaticMarkup(
      createElement(DraftNotice, { visible: true }),
    );

    expect(html).not.toContain("<button");
  });

  it("wires the discard handler onto the start-fresh button", () => {
    const onDiscard = vi.fn();
    const tree = DraftNotice({ visible: true, onDiscard });

    const button = findButton(tree, "Start fresh");
    expect(button).not.toBeNull();
    expect((button?.props as AnyProps).type).toBe("button");

    (
      (button?.props as { onClick?: () => void }).onClick as () => void
    )();
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("wires the dismiss handler onto an accessible dismiss button", () => {
    const onDismiss = vi.fn();
    const tree = DraftNotice({ visible: true, onDismiss });

    const html = renderToStaticMarkup(
      createElement(DraftNotice, { visible: true, onDismiss }),
    );
    expect(html).toContain('aria-label="Dismiss restored draft notice"');

    const button = findButton(tree, "×");
    expect(button).not.toBeNull();

    (
      (button?.props as { onClick?: () => void }).onClick as () => void
    )();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
