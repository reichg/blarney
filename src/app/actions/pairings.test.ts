import {
  generatePairings,
  publishPairings,
  updatePairingGroup,
} from "@/app/actions/pairings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  participantFindMany,
  pairingGroupFindMany,
  pairingMemberDeleteMany,
  pairingGroupDeleteMany,
  pairingGroupCreate,
  pairingGroupUpdate,
  pairingGroupUpdateMany,
  verifyChairToken,
  cookies,
  redirect,
  revalidatePath,
} = vi.hoisted(() => ({
  participantFindMany: vi.fn(),
  pairingGroupFindMany: vi.fn(),
  pairingMemberDeleteMany: vi.fn(),
  pairingGroupDeleteMany: vi.fn(),
  pairingGroupCreate: vi.fn(),
  pairingGroupUpdate: vi.fn(),
  pairingGroupUpdateMany: vi.fn(),
  verifyChairToken: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
}));

vi.mock("@/lib/db", () => ({
  db: {
    participant: {
      findMany: participantFindMany,
    },
    pairingGroup: {
      create: pairingGroupCreate,
      deleteMany: pairingGroupDeleteMany,
      findMany: pairingGroupFindMany,
      update: pairingGroupUpdate,
      updateMany: pairingGroupUpdateMany,
    },
    pairingMember: {
      deleteMany: pairingMemberDeleteMany,
    },
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === "function") {
        return input({
          pairingGroup: {
            create: pairingGroupCreate,
            deleteMany: pairingGroupDeleteMany,
            findMany: pairingGroupFindMany,
          },
          pairingMember: {
            deleteMany: pairingMemberDeleteMany,
          },
        });
      }

      return input;
    }),
  },
}));

vi.mock("@/lib/pairings", () => ({
  buildPairingGroups: vi.fn(() => []),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

function buildPairingFormData() {
  const formData = new FormData();
  formData.set("id", "group-1");
  formData.set("name", "Group 1");
  formData.set("sortOrder", "1");
  formData.set("teeTime", "2026-05-05T10:00");
  return formData;
}

beforeEach(() => {
  cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "chair-token" }),
  });
  verifyChairToken.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("pairing actions", () => {
  it("redirects generatePairings to chair login before loading participants when the session is missing", async () => {
    verifyChairToken.mockResolvedValue(false);

    await expect(generatePairings()).rejects.toThrow("REDIRECT:/chair/login");

    expect(redirect).toHaveBeenCalledWith("/chair/login");
    expect(participantFindMany).not.toHaveBeenCalled();
  });

  it("redirects updatePairingGroup to chair login before mutating when the session is missing", async () => {
    verifyChairToken.mockResolvedValue(false);

    await expect(updatePairingGroup(buildPairingFormData())).rejects.toThrow(
      "REDIRECT:/chair/login",
    );

    expect(redirect).toHaveBeenCalledWith("/chair/login");
    expect(pairingGroupUpdate).not.toHaveBeenCalled();
  });

  it("redirects publishPairings to chair login before publishing when the session is missing", async () => {
    verifyChairToken.mockResolvedValue(false);

    await expect(publishPairings()).rejects.toThrow("REDIRECT:/chair/login");

    expect(redirect).toHaveBeenCalledWith("/chair/login");
    expect(pairingGroupUpdateMany).not.toHaveBeenCalled();
  });
});
