import {
  filterChairListItems,
  parseChairListFilterParam,
  pickSearchParams,
  type ChairListSearchItem,
} from "@/app/chair/listFiltering";
import { describe, expect, it } from "vitest";

const items = [
  {
    id: "registration-1",
    searchText: "Ada Lovelace ada@example.com complete golf",
    filters: ["status:confirmed", "type:golf"],
  },
  {
    id: "rsvp-1",
    searchText: "Grace Hopper grace@example.com bbq kids",
    filters: ["status:pending", "type:rsvp"],
  },
  {
    id: "feedback-1",
    searchText: "Anonymous pace of play message",
    filters: ["status:unrated", "type:feedback"],
  },
] satisfies ChairListSearchItem[];

describe("filterChairListItems", () => {
  it("returns every item when search and filter are empty", () => {
    expect(filterChairListItems(items, "", "")).toEqual(items);
  });

  it("matches search text case-insensitively", () => {
    expect(
      filterChairListItems(items, "HOPPER", "").map((item) => item.id),
    ).toEqual(["rsvp-1"]);
  });

  it("matches filter tokens exactly after normalization", () => {
    expect(
      filterChairListItems(items, "", " status:confirmed ").map(
        (item) => item.id,
      ),
    ).toEqual(["registration-1"]);
  });

  it("requires both the search query and filter to match", () => {
    expect(
      filterChairListItems(items, "ada", "type:rsvp").map((item) => item.id),
    ).toEqual([]);
  });
});

describe("parseChairListFilterParam", () => {
  it("returns an empty value when the param is missing", () => {
    expect(parseChairListFilterParam(undefined)).toBe("");
  });

  it("uses the first value when duplicate params are present", () => {
    expect(
      parseChairListFilterParam({
        filter: [" status:confirmed ", "type:golf"],
      }),
    ).toBe("status:confirmed");
  });

  it("drops oversized filter values", () => {
    expect(parseChairListFilterParam({ filter: `${"a".repeat(81)}` })).toBe("");
  });
});

describe("pickSearchParams", () => {
  it("keeps only the allowlisted keys", () => {
    expect(
      pickSearchParams(
        {
          filter: "status:confirmed",
          page: "2",
          unrelated: "discard",
        },
        ["page", "filter"],
      ),
    ).toEqual({
      filter: "status:confirmed",
      page: "2",
    });
  });
});
