import { describe, it, expect } from "vitest";
import {
  addCalendarDays,
  canonicalAlias,
  normalizeHeader,
  parseCalendarDate,
} from "@/lib/engine/normalize";
import { DEFAULT_NORMALIZATION } from "@/lib/engine/types";
import { formatDate, formatTime, toExcelNumFmt } from "@/lib/engine/format";
import { evaluateFormula } from "@/lib/engine/formulaEngine";

describe("Header normalization (equivalent source headers)", () => {
  it("treats spacing/casing variants as the same key", () => {
    expect(normalizeHeader("A M OnDuty")).toBe(normalizeHeader("A M  OnDuty"));
    expect(normalizeHeader("A M OnDuty ")).toBe(normalizeHeader("a m onduty"));
  });
});

describe("Date parsing", () => {
  it("parses day-first strings using the format hint", () => {
    expect(parseCalendarDate("14/07/2026", "DD/MM/YYYY")?.iso).toBe("2026-07-14");
  });
  it("parses ISO unambiguously", () => {
    expect(parseCalendarDate("2026-07-14")?.iso).toBe("2026-07-14");
  });
  it("parses JS Date and Excel serial", () => {
    expect(parseCalendarDate(new Date(2026, 6, 14))?.iso).toBe("2026-07-14");
    const serial = Math.round((Date.UTC(2026, 6, 14) - Date.UTC(1899, 11, 30)) / 86400000);
    expect(parseCalendarDate(serial)?.iso).toBe("2026-07-14");
  });
  it("adds calendar days across month boundaries", () => {
    expect(addCalendarDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("rejects impossible dates", () => {
    expect(parseCalendarDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
  });
});

describe("Alias equivalence", () => {
  it("maps alias-group members to a canonical value", () => {
    const norm = { ...DEFAULT_NORMALIZATION, aliasGroups: [["Absent", "Absect", "Absence"]] };
    expect(canonicalAlias("Absect", norm)).toBe(canonicalAlias("Absent", norm));
    expect(canonicalAlias("Absence", norm)).toBe(canonicalAlias("Absent", norm));
  });
});

describe("Output formatting", () => {
  it("formats dates with the target token format (case-insensitive)", () => {
    expect(formatDate("2026-07-14", "DD/MM/YYYY")).toBe("14/07/2026");
    expect(formatDate("2026-07-14", "dd/mm/yyyy")).toBe("14/07/2026");
  });
  it("formats 12-hour and 24-hour times", () => {
    expect(formatTime("21:00", "h:mm AM/PM")).toBe("9:00 PM");
    expect(formatTime("9:00 AM", "HH:mm")).toBe("09:00");
    expect(formatTime("9:00 PM", "hh:mm")).toBe("21:00");
    expect(formatTime("9:00 PM", "hh:mm AM/PM")).toBe("09:00 PM");
  });
  it("a blank or missing format pattern falls back to the default, never an empty cell", () => {
    expect(formatDate("2026-07-14", "")).toBe("2026-07-14");
    expect(formatDate("2026-07-14", "   ")).toBe("2026-07-14");
    expect(formatDate("2026-07-14", undefined)).toBe("2026-07-14");
    expect(formatTime("21:00", "")).toBe("21:00");
    expect(toExcelNumFmt("date", { dateFormat: "" })).toBe("yyyy-mm-dd");
    expect(toExcelNumFmt("time", { timeFormat: "" })).toBe("hh:mm");
  });
});

describe("Formula engine", () => {
  const ctx = {
    getColumn: (name: string) => ({ First: "John", Last: "Doe", Code: "007" }[name] ?? null),
    lookupCalendarDay: () => "LOOKED_UP",
  };
  it("concatenates with & and CONCAT", () => {
    expect(evaluateFormula('[First] & " " & [Last]', ctx)).toBe("John Doe");
    expect(evaluateFormula('CONCAT([First], "-", [Last])', ctx)).toBe("John-Doe");
  });
  it("supports IF and ISBLANK", () => {
    expect(evaluateFormula('IF(ISBLANK([Missing]), "none", [First])', ctx)).toBe("none");
  });
  it("exposes NEXT_CALENDAR_DAY with configured column names", () => {
    expect(evaluateFormula("NEXT_CALENDAR_DAY([UserID], [Date], [AM])", ctx)).toBe("LOOKED_UP");
  });
});
