import { PairingGolferCard } from "@/app/chair/pairings/PairingGolferCard";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/pairings", () => ({
  assignPairingMember: async () => {},
}));

vi.mock("@/app/chair/chair.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/chair/PreviewDetailCard", () => ({
  PreviewDetailCard: ({
    preview,
    title,
    children,
  }: {
    preview: ReactNode;
    title: string;
    children: ReactNode;
  }) =>
    createElement(
      "section",
      null,
      createElement("div", { "data-title": title }, title),
      createElement("div", { "data-slot": "preview" }, preview),
      createElement("div", { "data-slot": "details" }, children),
    ),
}));

describe("PairingGolferCard", () => {
  it("shows the available state for an unassigned golfer", () => {
    const html = renderToStaticMarkup(
      createElement(PairingGolferCard, {
        golfer: {
          age: 54,
          averageScore: 44,
          draftAssignment: null,
          firstName: "Una",
          gender: "MALE",
          id: "golfer-open",
          lastName: "Open",
          pairingNote: "Prefers a steady group and an early tee time.",
        },
        groupOptions: [
          {
            disabled: false,
            id: "group-1",
            label: "Group 1 (0/4)",
          },
        ],
      }),
    );

    expect(html).toContain("Available");
    expect(html).toContain("Assign to draft group");
    expect(html).toContain("Pairing note");
    expect(html).toContain("Prefers a steady group and an early tee time.");
    expect(html).not.toContain("N/A");
  });
});
