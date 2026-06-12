import {
  assignPairingMember,
  createPairingGroup,
  deletePairingGroup,
  generatePairings,
  publishPairings,
  removePairingMember,
  unpublishPairings,
  updatePairingGroup,
} from "@/app/actions/pairings";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

const {
  participantFindMany,
  participantFindUnique,
  pairingGroupFindMany,
  pairingGroupFindUnique,
  pairingMemberFindMany,
  pairingMemberFindUnique,
  pairingMemberDeleteMany,
  pairingGroupDelete,
  pairingGroupDeleteMany,
  pairingGroupCreate,
  pairingGroupUpdate,
  pairingGroupUpdateMany,
  pairingMemberCreate,
  pairingMemberDelete,
  pairingMemberUpdate,
  verifyChairToken,
  cookies,
  redirect,
  revalidatePath,
} = vi.hoisted(() => ({
  participantFindMany: vi.fn(),
  participantFindUnique: vi.fn(),
  pairingGroupFindMany: vi.fn(),
  pairingGroupFindUnique: vi.fn(),
  pairingMemberFindMany: vi.fn(),
  pairingMemberFindUnique: vi.fn(),
  pairingMemberDeleteMany: vi.fn(),
  pairingGroupDelete: vi.fn(),
  pairingGroupDeleteMany: vi.fn(),
  pairingGroupCreate: vi.fn(),
  pairingGroupUpdate: vi.fn(),
  pairingGroupUpdateMany: vi.fn(),
  pairingMemberCreate: vi.fn(),
  pairingMemberDelete: vi.fn(),
  pairingMemberUpdate: vi.fn(),
  verifyChairToken: vi.fn(),
  cookies: vi.fn(),
  // Mirrors next/navigation: redirect() throws, which is how the auth guard
  // bails out before the action body runs.
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
      findUnique: participantFindUnique,
    },
    pairingGroup: {
      create: pairingGroupCreate,
      delete: pairingGroupDelete,
      deleteMany: pairingGroupDeleteMany,
      findMany: pairingGroupFindMany,
      findUnique: pairingGroupFindUnique,
      update: pairingGroupUpdate,
      updateMany: pairingGroupUpdateMany,
    },
    pairingMember: {
      create: pairingMemberCreate,
      delete: pairingMemberDelete,
      deleteMany: pairingMemberDeleteMany,
      findMany: pairingMemberFindMany,
      findUnique: pairingMemberFindUnique,
      update: pairingMemberUpdate,
    },
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === "function") {
        return input({
          participant: {
            findUnique: participantFindUnique,
          },
          pairingGroup: {
            create: pairingGroupCreate,
            delete: pairingGroupDelete,
            deleteMany: pairingGroupDeleteMany,
            findMany: pairingGroupFindMany,
            findUnique: pairingGroupFindUnique,
            updateMany: pairingGroupUpdateMany,
          },
          pairingMember: {
            create: pairingMemberCreate,
            delete: pairingMemberDelete,
            deleteMany: pairingMemberDeleteMany,
            findMany: pairingMemberFindMany,
            findUnique: pairingMemberFindUnique,
            update: pairingMemberUpdate,
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

function buildCreateGroupFormData(returnTo?: string) {
  const formData = new FormData();
  formData.set("name", "Custom Group 1");
  formData.set("sortOrder", "1");
  formData.set("teeTime", "2026-05-05T09:30");
  if (returnTo !== undefined) {
    formData.set("returnTo", returnTo);
  }
  return formData;
}

function buildDeleteGroupFormData() {
  const formData = new FormData();
  formData.set("id", "group-1");
  return formData;
}

function buildUpdateGroupFormData() {
  const formData = new FormData();
  formData.set("id", "group-1");
  formData.set("name", "Group 1");
  formData.set("sortOrder", "1");
  formData.set("teeTime", "2026-05-05T10:00");
  return formData;
}

function buildAssignMemberFormData() {
  const formData = new FormData();
  formData.set("groupId", "group-1");
  formData.set("participantId", "participant-1");
  return formData;
}

function buildRemoveMemberFormData() {
  const formData = new FormData();
  formData.set("memberId", "member-1");
  return formData;
}

let consoleErrorSpy: MockInstance;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "chair-token" }),
  });
  pairingMemberFindMany.mockResolvedValue([]);
  verifyChairToken.mockResolvedValue(true);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.clearAllMocks();
});

describe("pairing actions", () => {
  describe("authorization", () => {
    it("redirects generatePairings to chair login before loading participants when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(generatePairings()).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(participantFindMany).not.toHaveBeenCalled();
    });

    it("redirects createPairingGroup to chair login before creating when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(
        createPairingGroup(buildCreateGroupFormData()),
      ).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingGroupCreate).not.toHaveBeenCalled();
    });

    it("redirects updatePairingGroup to chair login before mutating when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(
        updatePairingGroup(buildUpdateGroupFormData()),
      ).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingGroupUpdate).not.toHaveBeenCalled();
    });

    it("redirects deletePairingGroup to chair login before deleting when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(
        deletePairingGroup(buildDeleteGroupFormData()),
      ).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingGroupDelete).not.toHaveBeenCalled();
    });

    it("redirects assignPairingMember to chair login before assigning when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(
        assignPairingMember(buildAssignMemberFormData()),
      ).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingGroupFindUnique).not.toHaveBeenCalled();
    });

    it("redirects removePairingMember to chair login before removing when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(
        removePairingMember(buildRemoveMemberFormData()),
      ).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingMemberFindUnique).not.toHaveBeenCalled();
    });

    it("redirects publishPairings to chair login before publishing when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(publishPairings()).rejects.toThrow("REDIRECT:/chair/login");

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingGroupUpdateMany).not.toHaveBeenCalled();
    });

    it("redirects unpublishPairings to chair login before mutating when the session is missing", async () => {
      verifyChairToken.mockResolvedValue(false);

      await expect(unpublishPairings()).rejects.toThrow(
        "REDIRECT:/chair/login",
      );

      expect(redirect).toHaveBeenCalledWith("/chair/login");
      expect(pairingGroupFindMany).not.toHaveBeenCalled();
    });
  });

  describe("generatePairings", () => {
    it("replaces existing draft groups and resolves with the generated notice", async () => {
      participantFindMany.mockResolvedValue([]);
      pairingGroupFindMany.mockResolvedValue([{ id: "draft-1" }]);

      // Resolving (never throwing) is the scroll-preservation contract: the
      // client hook navigates from the returned URL instead of a thrown
      // redirect.
      await expect(generatePairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=generated",
      });

      expect(redirect).not.toHaveBeenCalled();
      expect(pairingMemberDeleteMany).toHaveBeenCalledWith({
        where: { groupId: { in: ["draft-1"] } },
      });
      expect(pairingGroupDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["draft-1"] } },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });
  });

  describe("createPairingGroup", () => {
    it("creates a new draft pairing group", async () => {
      await expect(
        createPairingGroup(buildCreateGroupFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=group-created",
      });

      expect(pairingGroupCreate).toHaveBeenCalledWith({
        data: {
          name: "Custom Group 1",
          sortOrder: 1,
          status: "DRAFT",
          // 2026-05-05 is PDT (UTC-7), so 09:30 Pacific is 16:30 UTC. Compare
          // against an explicit UTC instant so the assertion is independent of
          // the test runner's timezone.
          teeTime: new Date(Date.UTC(2026, 4, 5, 16, 30, 0)),
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });

    it("allows draft groups without tee times", async () => {
      const formData = buildCreateGroupFormData();
      formData.set("teeTime", "");

      await expect(createPairingGroup(formData)).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=group-created",
      });

      expect(pairingGroupCreate).toHaveBeenCalledWith({
        data: {
          name: "Custom Group 1",
          sortOrder: 1,
          status: "DRAFT",
          teeTime: null,
        },
      });
    });

    it("resolves with action-failed and logs when the create fails", async () => {
      // Once: vi.clearAllMocks() does not remove persistent implementations.
      pairingGroupCreate.mockRejectedValueOnce(new Error("db down"));

      await expect(
        createPairingGroup(buildCreateGroupFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=action-failed",
      });

      expect(revalidatePath).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("deletePairingGroup", () => {
    it("deletes only draft pairing groups", async () => {
      await expect(
        deletePairingGroup(buildDeleteGroupFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=group-deleted",
      });

      expect(pairingGroupDelete).toHaveBeenCalledWith({
        where: { id: "group-1", status: "DRAFT" },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });
  });

  describe("updatePairingGroup", () => {
    it("updates only draft pairing groups", async () => {
      await expect(
        updatePairingGroup(buildUpdateGroupFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=group-updated",
      });

      expect(pairingGroupUpdate).toHaveBeenCalledWith({
        where: { id: "group-1", status: "DRAFT" },
        data: {
          name: "Group 1",
          sortOrder: 1,
          // 2026-05-05 is PDT (UTC-7), so 10:00 Pacific is 17:00 UTC.
          teeTime: new Date(Date.UTC(2026, 4, 5, 17, 0, 0)),
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("assignPairingMember", () => {
    it("assigns a participant to a draft group", async () => {
      pairingGroupFindUnique.mockResolvedValue({
        id: "group-1",
        status: "DRAFT",
        members: [
          { id: "member-1", slot: 1, participantId: "participant-2" },
          { id: "member-2", slot: 2, participantId: "participant-3" },
        ],
      });

      participantFindUnique.mockResolvedValue({
        id: "participant-1",
        age: 45,
        gender: "MALE",
        averageScore: 38,
      });

      pairingMemberFindMany
        .mockResolvedValueOnce([{ id: "old-member-1", groupId: "group-2" }])
        .mockResolvedValueOnce([{ id: "member-5", slot: 2 }]);

      await expect(
        assignPairingMember(buildAssignMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=member-assigned",
      });

      expect(pairingMemberDeleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["old-member-1"] },
        },
      });

      expect(pairingMemberUpdate).toHaveBeenCalledWith({
        where: { id: "member-5" },
        data: { slot: 1 },
      });

      expect(pairingMemberCreate).toHaveBeenCalledWith({
        data: {
          groupId: "group-1",
          participantId: "participant-1",
          slot: 3,
          snapshotAge: 45,
          snapshotGender: "MALE",
          snapshotScore: 38,
        },
      });

      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });

    it("does not duplicate a participant already assigned to the target group", async () => {
      pairingGroupFindUnique.mockResolvedValue({
        id: "group-1",
        status: "DRAFT",
        members: [
          { id: "member-1", slot: 1, participantId: "participant-1" },
          { id: "member-2", slot: 2, participantId: "participant-2" },
          { id: "member-3", slot: 3, participantId: "participant-3" },
          { id: "member-4", slot: 4, participantId: "participant-4" },
        ],
      });

      pairingMemberFindMany.mockResolvedValue([
        { id: "member-1", groupId: "group-1" },
      ]);

      await expect(
        assignPairingMember(buildAssignMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=member-assigned",
      });

      expect(pairingMemberDeleteMany).not.toHaveBeenCalled();
      expect(pairingMemberCreate).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });

    it("removes participant from other draft groups before assigning", async () => {
      pairingGroupFindUnique.mockResolvedValue({
        id: "group-1",
        status: "DRAFT",
        members: [],
      });

      participantFindUnique.mockResolvedValue({
        id: "participant-1",
        age: 45,
        gender: "MALE",
        averageScore: 38,
      });

      pairingMemberFindMany
        .mockResolvedValueOnce([
          { id: "old-member-1", groupId: "group-2" },
          { id: "old-member-2", groupId: "group-3" },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await expect(
        assignPairingMember(buildAssignMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=member-assigned",
      });

      expect(pairingMemberDeleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["old-member-1", "old-member-2"] },
        },
      });

      expect(pairingMemberCreate).toHaveBeenCalledWith({
        data: {
          groupId: "group-1",
          participantId: "participant-1",
          slot: 1,
          snapshotAge: 45,
          snapshotGender: "MALE",
          snapshotScore: 38,
        },
      });

      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });

    it("resolves with action-failed when assigning to a group that is full", async () => {
      pairingGroupFindUnique.mockResolvedValue({
        id: "group-1",
        status: "DRAFT",
        members: [
          { id: "member-1", slot: 1 },
          { id: "member-2", slot: 2 },
          { id: "member-3", slot: 3 },
          { id: "member-4", slot: 4 },
        ],
      });

      await expect(
        assignPairingMember(buildAssignMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=action-failed",
      });

      expect(pairingMemberCreate).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("resolves with action-failed when assigning to a published group", async () => {
      pairingGroupFindUnique.mockResolvedValue({
        id: "group-1",
        status: "PUBLISHED",
        members: [],
      });

      await expect(
        assignPairingMember(buildAssignMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=action-failed",
      });

      expect(pairingMemberCreate).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("removePairingMember", () => {
    it("removes a member from a draft group and compacts slots", async () => {
      pairingMemberFindUnique.mockResolvedValue({
        id: "member-1",
        groupId: "group-1",
        participantId: "participant-2",
        slot: 2,
        group: { id: "group-1", status: "DRAFT" },
      });

      pairingMemberFindMany.mockResolvedValue([
        { id: "member-2", slot: 1 },
        { id: "member-3", slot: 3 },
        { id: "member-4", slot: 4 },
      ]);

      await expect(
        removePairingMember(buildRemoveMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=member-removed",
      });

      expect(pairingMemberDelete).toHaveBeenCalledWith({
        where: { id: "member-1" },
      });

      expect(pairingMemberUpdate).toHaveBeenCalledWith({
        where: { id: "member-3" },
        data: { slot: 2 },
      });

      expect(pairingMemberUpdate).toHaveBeenCalledWith({
        where: { id: "member-4" },
        data: { slot: 3 },
      });

      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
    });

    it("resolves with action-failed when removing from a published group", async () => {
      pairingMemberFindUnique.mockResolvedValue({
        id: "member-1",
        groupId: "group-1",
        participantId: "participant-1",
        slot: 1,
        group: { id: "group-1", status: "PUBLISHED" },
      });

      await expect(
        removePairingMember(buildRemoveMemberFormData()),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=action-failed",
      });

      expect(pairingMemberDelete).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("publishPairings", () => {
    it("is idempotent when no draft groups exist", async () => {
      pairingGroupUpdateMany.mockResolvedValueOnce({ count: 0 });

      await expect(publishPairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=published",
      });

      expect(pairingGroupUpdateMany).toHaveBeenCalledTimes(1);
      expect(pairingGroupUpdateMany).toHaveBeenCalledWith({
        where: { status: "DRAFT" },
        data: expect.objectContaining({
          status: "PUBLISHED",
        }),
      });
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("publishes draft groups and archives only older published groups", async () => {
      pairingGroupUpdateMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });

      await expect(publishPairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=published",
      });

      expect(pairingGroupUpdateMany).toHaveBeenCalledWith({
        where: { status: "DRAFT" },
        data: expect.objectContaining({
          status: "PUBLISHED",
        }),
      });

      expect(pairingGroupUpdateMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          OR: [
            { publishedAt: null },
            { publishedAt: { lt: expect.any(Date) } },
          ],
        },
        data: { status: "ARCHIVED" },
      });

      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("unpublishPairings", () => {
    it("resolves with unpublish-conflict when draft groups already exist", async () => {
      pairingGroupFindMany.mockResolvedValueOnce([{ id: "draft-1" }]);

      await expect(unpublishPairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=unpublish-conflict",
      });

      expect(pairingGroupUpdateMany).not.toHaveBeenCalled();
      // Conflicts are an expected user-facing outcome, not a server fault.
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("resolves with unpublish-error when the transaction fails unexpectedly", async () => {
      pairingGroupFindMany.mockRejectedValueOnce(new Error("db down"));

      await expect(unpublishPairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=unpublish-error",
      });

      expect(pairingGroupUpdateMany).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("is idempotent when there are no published groups", async () => {
      pairingGroupFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await expect(unpublishPairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=unpublished",
      });

      expect(pairingGroupUpdateMany).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("moves published groups back to draft and clears publish timestamps", async () => {
      pairingGroupFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "published-1" }, { id: "published-2" }]);

      await expect(unpublishPairings()).resolves.toEqual({
        redirectTo: "/chair/pairings?pairings=unpublished",
      });

      expect(pairingGroupUpdateMany).toHaveBeenCalledWith({
        where: { status: "PUBLISHED" },
        data: { publishedAt: null, status: "DRAFT" },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/chair/pairings");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("returnTo sanitization", () => {
    it("preserves a relative /chair/pairings return path and appends the notice code", async () => {
      await expect(
        createPairingGroup(
          buildCreateGroupFormData("/chair/pairings?focus=group-2"),
        ),
      ).resolves.toEqual({
        redirectTo: "/chair/pairings?focus=group-2&pairings=group-created",
      });

      expect(redirect).not.toHaveBeenCalled();
      expect(pairingGroupCreate).toHaveBeenCalled();
    });

    it.each([
      "https://evil.test/x",
      "//evil.test",
      "/chair/pairings\\..",
      "/chair/registrations",
    ])(
      "falls back to /chair/pairings for unsafe returnTo %s",
      async (returnTo) => {
        await expect(
          createPairingGroup(buildCreateGroupFormData(returnTo)),
        ).resolves.toEqual({
          redirectTo: "/chair/pairings?pairings=group-created",
        });

        expect(redirect).not.toHaveBeenCalled();
      },
    );
  });
});
