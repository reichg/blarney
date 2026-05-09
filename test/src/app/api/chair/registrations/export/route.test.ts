import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildChairRegistrationCsv, registrationFindMany, verifyChairToken } =
  vi.hoisted(() => ({
    buildChairRegistrationCsv: vi.fn(),
    registrationFindMany: vi.fn(),
    verifyChairToken: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
}));

vi.mock("@/lib/chairRegistrationExport", () => ({
  buildChairRegistrationCsv,
}));

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      findMany: registrationFindMany,
    },
  },
}));

import { GET } from "@/app/api/chair/registrations/export/route";

beforeEach(() => {
  verifyChairToken.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair registrations export route", () => {
  it("returns unauthorized before loading registrations when chair auth is missing", async () => {
    verifyChairToken.mockResolvedValue(false);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/chair/registrations/export"),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized.",
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(registrationFindMany).not.toHaveBeenCalled();
    expect(buildChairRegistrationCsv).not.toHaveBeenCalled();
  });

  it("ignores pagination query params and exports the full dataset", async () => {
    const registrations = [{ id: "registration-1" }, { id: "registration-2" }];

    registrationFindMany.mockResolvedValue(registrations);
    buildChairRegistrationCsv.mockReturnValue("csv-body");

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/chair/registrations/export?page=2&pageSize=1",
      ),
    );

    expect(buildChairRegistrationCsv).toHaveBeenCalledWith(
      registrations,
      "general",
    );

    const query = registrationFindMany.mock.calls[0]?.[0];

    expect(query).not.toHaveProperty("skip");
    expect(query).not.toHaveProperty("take");
    await expect(response.text()).resolves.toBe("csv-body");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="blarney-42-registrations.csv"',
    );
  });
});
