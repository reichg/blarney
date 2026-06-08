// @vitest-environment jsdom

import { isPersistableField } from "@/lib/formDraft";
import { describe, expect, it } from "vitest";

/**
 * `isPersistableField` switches on real DOM constructors (`instanceof
 * HTMLInputElement` etc.), so this suite requires a DOM environment rather than
 * the default node pool. Inputs are built from real elements so the type and
 * autocomplete heuristics are exercised exactly as in the browser.
 */
function input(attrs: Record<string, string>): HTMLInputElement {
  const element = document.createElement("input");
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  return element;
}

describe("isPersistableField — allowed controls", () => {
  it("allows text-like inputs", () => {
    for (const type of [
      "text",
      "email",
      "tel",
      "url",
      "number",
      "search",
      "date",
      "time",
      "datetime-local",
    ]) {
      expect(isPersistableField(input({ type, name: "field" }))).toBe(true);
    }
  });

  it("allows textareas and selects", () => {
    const textarea = document.createElement("textarea");
    textarea.name = "message";
    expect(isPersistableField(textarea)).toBe(true);

    const select = document.createElement("select");
    select.name = "variant";
    expect(isPersistableField(select)).toBe(true);
  });
});

describe("isPersistableField — blocked by type", () => {
  it("blocks password, file, hidden, submit, button, reset, and image inputs", () => {
    for (const type of [
      "password",
      "file",
      "hidden",
      "submit",
      "button",
      "reset",
      "image",
    ]) {
      expect(isPersistableField(input({ type, name: "field" }))).toBe(false);
    }
  });

  it("blocks input types outside the text-like allow list", () => {
    for (const type of ["checkbox", "radio", "color", "range"]) {
      expect(isPersistableField(input({ type, name: "field" }))).toBe(false);
    }
  });

  it("blocks non form-control elements", () => {
    expect(isPersistableField(document.createElement("div"))).toBe(false);
  });
});

describe("isPersistableField — blocked by autocomplete", () => {
  it("blocks credential and one-time-code autocomplete hints", () => {
    for (const autocomplete of [
      "off",
      "current-password",
      "new-password",
      "one-time-code",
    ]) {
      expect(
        isPersistableField(input({ type: "text", name: "field", autocomplete })),
      ).toBe(false);
    }
  });
});

describe("isPersistableField — blocked by sensitive name/id", () => {
  it("blocks fields whose name matches the sensitive pattern", () => {
    for (const name of ["password", "csrfToken", "cvv", "__chair", "jwt"]) {
      expect(isPersistableField(input({ type: "text", name }))).toBe(false);
    }
  });

  it("blocks fields whose id matches the sensitive pattern", () => {
    expect(
      isPersistableField(input({ type: "text", id: "auth-secret" })),
    ).toBe(false);
  });

  it("blocks fields opted out via data-no-persist", () => {
    expect(
      isPersistableField(
        input({ type: "text", name: "notes", "data-no-persist": "" }),
      ),
    ).toBe(false);

    const textarea = document.createElement("textarea");
    textarea.name = "notes";
    textarea.setAttribute("data-no-persist", "");
    expect(isPersistableField(textarea)).toBe(false);
  });
});
