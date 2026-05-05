import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { registrationFindMany, buildChairRegistrationCsv } = vi.hoisted(() => ({
  registrationFindMany: vi.fn(),
  buildChairRegistrationCsv: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      findMany: registrationFindMany,
    },
  },
}));

vi.mock("@/lib/chairRegistrationExport", () => ({
  buildChairRegistrationCsv,
}));

import { GET } from "@/app/api/chair/registrations/export/route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair registrations export route", () => {
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
