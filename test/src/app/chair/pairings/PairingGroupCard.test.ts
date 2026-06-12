import { PairingGroupCard } from "@/app/chair/pairings/PairingGroupCard";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/pairings", () => ({
  deletePairingGroup: async () => {},
  removePairingMember: async () => {},
  updatePairingGroup: async () => {},
}));

// The card's ChairActionForm wrappers resolve a router for scroll-preserving
// navigation; the toast context safely defaults to a no-op without a provider.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
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

vi.mock("@/lib/format", () => ({
  formatDateTime: () => "9:30 AM",
}));

describe("PairingGroupCard", () => {
  it("shows golfer names, ages, and scores in the draft preview and keeps delete enabled", () => {
    const html = renderToStaticMarkup(
      createElement(PairingGroupCard, {
        group: {
          id: "group-1",
          members: [
            {
              id: "member-1",
              participant: {
                firstName: "Pat",
                lastName: "Smith",
              },
              slot: 1,
              snapshotAge: 72,
              snapshotScore: 39,
            },
            {
              id: "member-2",
              participant: {
                firstName: "Jamie",
                lastName: "Doe",
              },
              slot: 2,
              snapshotAge: 55,
              snapshotScore: 44,
            },
          ],
          name: "Group 1",
          sortOrder: 1,
          status: "DRAFT",
          teeTime: null,
        },
        isDraft: true,
      }),
    );

    expect(html).toContain("Pat Smith");
    expect(html).toContain("Age 72 | Score 39");
    expect(html).toContain("Jamie Doe");
    expect(html).toContain("Age 55 | Score 44");
    expect(html).toContain("Delete group");
    expect(html).not.toContain("disabled");
  });
});
