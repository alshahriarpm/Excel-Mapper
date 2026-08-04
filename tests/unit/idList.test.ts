import { describe, it, expect } from "vitest";
import { columnValues, extractIds, pickIdColumn } from "@/lib/engine/idList";

const roster = [
  { ID: "SS1388", Name: "Sujon Mahmud", Shift: "Night", Date: "2026-07-26" },
  { ID: "SS1400", Name: "Md. Nazmujh Sakib", Shift: "Night", Date: "2026-07-26" },
  { ID: "SS87", Name: "Rakib", Shift: "Night", Date: "2026-07-26" },
];
const headers = ["ID", "Name", "Shift", "Date"];

describe("Uploaded ID list", () => {
  it("takes only the ID column of a roster that also carries name/shift/date", () => {
    const { column, ids } = extractIds(roster, headers);
    expect(column).toBe("ID");
    expect(ids).toEqual(["SS1388", "SS1400", "SS87"]);
    expect(ids).not.toContain("Night");
    expect(ids).not.toContain("2026-07-26");
  });

  it("recognises other identifier headings", () => {
    expect(pickIdColumn([{ "Employee Code": "E1", Dept: "Prod" }], ["Employee Code", "Dept"])).toBe("Employee Code");
    expect(pickIdColumn([{ "User ID": "E1", Name: "A" }], ["User ID", "Name"])).toBe("User ID");
    expect(pickIdColumn([{ "Card No": "E1", Name: "A" }], ["Card No", "Name"])).toBe("Card No");
  });

  it("falls back to the fullest column when no header names an ID", () => {
    const rows = [
      { Alpha: "", Beta: "SS1" },
      { Alpha: "", Beta: "SS2" },
    ];
    expect(pickIdColumn(rows, ["Alpha", "Beta"])).toBe("Beta");
  });

  it("handles a single headerless column of IDs", () => {
    const rows = [{ A: "SS1" }, { A: "SS2" }, { A: "SS1" }];
    expect(columnValues(rows, "A")).toEqual(["SS1", "SS2"]);
  });

  it("trims, drops blanks and de-duplicates", () => {
    const rows = [{ ID: " SS1 " }, { ID: "" }, { ID: "SS1" }, { ID: "SS2" }];
    expect(columnValues(rows, "ID")).toEqual(["SS1", "SS2"]);
  });
});
