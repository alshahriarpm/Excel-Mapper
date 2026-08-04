import { describe, it, expect } from "vitest";
import { runConfigurableAttendanceTransform } from "@/lib/engine/configurableAttendanceTransform";
import type {
  ConversionRule,
  SourceConfiguration,
  SourceRow,
  TargetWorkbookConfiguration,
} from "@/lib/engine/types";
import {
  overnightRule,
  regularRule,
  row,
  sourceConfiguration,
  targetConfiguration,
} from "./fixtures";

function convert(
  rows: SourceRow[],
  opts: {
    rules?: ConversionRule[];
    defaultRule?: ConversionRule | null;
    target?: TargetWorkbookConfiguration;
    source?: SourceConfiguration;
    unique?: string[];
    uploadedList?: string[];
  } = {},
) {
  return runConfigurableAttendanceTransform({
    sourceRows: rows,
    targetConfiguration: opts.target ?? targetConfiguration(),
    sourceConfiguration: opts.source ?? sourceConfiguration(),
    rules: opts.rules ?? [overnightRule(), regularRule()],
    defaultRule: opts.defaultRule ?? null,
    uniqueTargetFields: opts.unique ?? ["emp", "date"],
    uploadedList: opts.uploadedList,
  });
}

const val = (r: ReturnType<typeof convert>["rows"][number], key: string) => r.cells[key]?.value ?? null;

describe("Configurable rules", () => {
  it("case 1: current-row rule fills In/Out from the same row", () => {
    const res = convert([
      row({ UserID: "E001", Date: "14/07/2026", "On Desc": "Absent", "A M OnDuty": "9:00 AM", "P M OffDuty": "6:00 PM" }),
    ]);
    const r = res.rows[0]!;
    expect(r.appliedRuleName).toBe("Regular Attendance");
    expect(val(r, "in")).toBe("9:00 AM");
    expect(val(r, "out")).toBe("6:00 PM");
    expect(r.status).toBe("ready");
  });

  it("case 2: next-calendar-date rule pulls Out from the following day", () => {
    const res = convert([
      row({ UserID: "E001", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E001", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "6:00 PM" }),
    ]);
    const r = res.rows[0]!;
    expect(r.appliedRuleName).toBe("Overnight Attendance");
    expect(val(r, "in")).toBe("9:00 PM");
    expect(val(r, "out")).toBe("7:00 AM");
    expect(r.status).toBe("ready");
  });

  it("case 3: changing the special condition value changes matching", () => {
    const customOvernight = overnightRule({
      conditions: [{ sourceColumn: "On Desc", operator: "equals", values: ["No Punch"] }],
    });
    const res = convert(
      [row({ UserID: "E1", Date: "01/01/2026", "On Desc": "No Punch", "P M OffDuty": "8:00 PM" })],
      { rules: [customOvernight, regularRule()] },
    );
    expect(res.rows[0]!.appliedRuleName).toBe("Overnight Attendance");
  });

  it("case 4: a different condition column is honored", () => {
    const rule = regularRule({
      conditions: [{ sourceColumn: "Status", operator: "equals", values: ["OK"] }],
    });
    const res = convert(
      [row({ UserID: "E1", Date: "01/01/2026", Status: "OK", "A M OnDuty": "9:00", "P M OffDuty": "17:00" })],
      { rules: [rule] },
    );
    expect(res.rows[0]!.status).toBe("ready");
    expect(val(res.rows[0]!, "in")).toBe("9:00");
  });

  it("case 5: different source-time columns are used per configuration", () => {
    const rule = regularRule({
      inTimeSource: { type: "current_row_column", column: "Morning" },
      outTimeSource: { type: "current_row_column", column: "Evening" },
      conditions: [],
    });
    const res = convert(
      [row({ UserID: "E1", Date: "01/01/2026", Morning: "8:30", Evening: "5:30" })],
      { rules: [rule] },
    );
    expect(val(res.rows[0]!, "in")).toBe("8:30");
    expect(val(res.rows[0]!, "out")).toBe("5:30");
  });

  it("case 6: completely different target column names still work (no hardcoding)", () => {
    const target = targetConfiguration({
      columns: [
        { key: "staff", header: "Staff Code", displayName: "Staff Code", order: 0, required: true, detectedType: "text", role: "employee_id", mapping: { kind: "direct", sourceColumn: "UserID" } },
        { key: "wd", header: "Work Date", displayName: "Work Date", order: 1, required: true, detectedType: "date", role: "date", mapping: { kind: "direct", sourceColumn: "Date" } },
        { key: "start", header: "Start", displayName: "Start", order: 2, required: true, detectedType: "time", role: "in_time", mapping: { kind: "in_time" } },
        { key: "finish", header: "Finish", displayName: "Finish", order: 3, required: true, detectedType: "time", role: "out_time", mapping: { kind: "out_time" } },
      ],
    });
    const res = convert(
      [row({ UserID: "Z9", Date: "02/02/2026", "On Desc": "Absent", "A M OnDuty": "9:00", "P M OffDuty": "18:00" })],
      { target, unique: ["staff", "wd"] },
    );
    const r = res.rows[0]!;
    expect(val(r, "staff")).toBe("Z9");
    expect(val(r, "start")).toBe("9:00");
    expect(val(r, "finish")).toBe("18:00");
    expect(r.status).toBe("ready");
  });

  it("case 7 & 8: no rule and no default → No Matching Rule", () => {
    const res = convert([row({ UserID: "E1", Date: "01/01/2026", "On Desc": "Holiday" })]);
    expect(res.rows[0]!.status).toBe("no_matching_rule");
    expect(val(res.rows[0]!, "in")).toBeNull();
  });

  it("case 7b: optional default rule applies when nothing else matches", () => {
    const def = regularRule({ id: "default", name: "Default", conditions: [] });
    const res = convert([row({ UserID: "E1", Date: "01/01/2026", "On Desc": "Holiday", "A M OnDuty": "9:00", "P M OffDuty": "17:00" })], {
      defaultRule: def,
    });
    expect(res.rows[0]!.appliedRuleName).toBe("Default");
    expect(res.rows[0]!.status).toBe("ready");
  });

  it("case 9: multiple rules match → flagged", () => {
    const a = regularRule({ id: "a", name: "A", conditions: [{ sourceColumn: "On Desc", operator: "contains", values: ["late"] }], stopAfterMatch: false, order: 0 });
    const b = regularRule({ id: "b", name: "B", conditions: [{ sourceColumn: "On Desc", operator: "contains", values: ["arrive"] }], stopAfterMatch: false, order: 1 });
    const res = convert([row({ UserID: "E1", Date: "01/01/2026", "On Desc": "Arrive Late", "A M OnDuty": "9:00", "P M OffDuty": "17:00" })], {
      rules: [a, b],
    });
    const r = res.rows[0]!;
    expect(r.appliedRuleName).toBe("A");
    expect(r.status === "multiple_rules_matched" || r.warnings.includes("multiple_rules_matched")).toBe(true);
  });

  it("case 10: rule order changes which rule applies", () => {
    const a = regularRule({ id: "a", name: "A", conditions: [], inTimeSource: { type: "fixed", value: "AAA" }, outTimeSource: { type: "fixed", value: "aaa" }, order: 0 });
    const b = regularRule({ id: "b", name: "B", conditions: [], inTimeSource: { type: "fixed", value: "BBB" }, outTimeSource: { type: "fixed", value: "bbb" }, order: 1 });
    const first = convert([row({ UserID: "E1", Date: "01/01/2026" })], { rules: [a, b] });
    expect(first.rows[0]!.appliedRuleName).toBe("A");
    const swapped = convert([row({ UserID: "E1", Date: "01/01/2026" })], {
      rules: [{ ...a, order: 1 }, { ...b, order: 0 }],
    });
    expect(swapped.rows[0]!.appliedRuleName).toBe("B");
  });

  it("case 11: stop-after-match prevents multiple-match detection", () => {
    const a = regularRule({ id: "a", name: "A", conditions: [], stopAfterMatch: true, order: 0 });
    const b = regularRule({ id: "b", name: "B", conditions: [], stopAfterMatch: false, order: 1 });
    const res = convert([row({ UserID: "E1", Date: "01/01/2026", "A M OnDuty": "9:00", "P M OffDuty": "17:00" })], { rules: [a, b] });
    expect(res.rows[0]!.warnings.includes("multiple_rules_matched")).toBe(false);
    expect(res.rows[0]!.status).toBe("ready");
  });
});

describe("Missing values", () => {
  it("case 12 & 14: blank In Time forces blank Out Time", () => {
    const res = convert([
      row({ UserID: "E1", Date: "01/01/2026", "On Desc": "Absent", "A M OnDuty": "", "P M OffDuty": "6:00 PM" }),
    ]);
    const r = res.rows[0]!;
    expect(val(r, "in")).toBeNull();
    expect(val(r, "out")).toBeNull();
    expect(r.status).toBe("missing_in_time");
  });

  it("case 13 & 15: missing Out Time keeps a valid In Time", () => {
    const res = convert([
      row({ UserID: "E1", Date: "01/01/2026", "On Desc": "Absent", "A M OnDuty": "9:00 AM", "P M OffDuty": "" }),
    ]);
    const r = res.rows[0]!;
    expect(val(r, "in")).toBe("9:00 AM");
    expect(val(r, "out")).toBeNull();
    expect(r.status).toBe("missing_out_time");
  });

  it("case 16: next-day row missing → Next-Day Record Missing, In kept", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
    ]);
    const r = res.rows[0]!;
    expect(val(r, "in")).toBe("9:00 PM");
    expect(val(r, "out")).toBeNull();
    expect(r.status).toBe("next_day_record_missing");
  });

  it("case 17: next-day row exists but selected value is blank → Missing Out Time", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "", "P M OffDuty": "6:00 PM" }),
    ]);
    const r = res.rows[0]!;
    expect(val(r, "in")).toBe("9:00 PM");
    expect(val(r, "out")).toBeNull();
    expect(r.status).toBe("missing_out_time");
  });

  it("exclude behavior drops the record entirely", () => {
    const rule = regularRule({ missingInTimeBehavior: "exclude", conditions: [] });
    const res = convert([row({ UserID: "E1", Date: "01/01/2026", "A M OnDuty": "" })], { rules: [rule] });
    expect(res.rows[0]!.excluded).toBe(true);
    expect(res.rows[0]!.status).toBe("excluded");
  });
});

describe("Duplicate validation", () => {
  const base = () => [
    row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Absent", "A M OnDuty": "9:00", "P M OffDuty": "17:00" }),
    row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Absent", "A M OnDuty": "9:05", "P M OffDuty": "17:05" }),
  ];

  it("case 53/54: same employee+date is a duplicate", () => {
    const res = convert(base(), { unique: ["emp", "date"] });
    expect(res.rows[0]!.status).toBe("ready");
    expect(res.rows[1]!.status === "duplicate" || res.rows[1]!.warnings.includes("duplicate")).toBe(true);
  });

  it("case 51: a single unique field flags across different dates", () => {
    const rows = [
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Absent", "A M OnDuty": "9:00", "P M OffDuty": "17:00" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "9:00", "P M OffDuty": "17:00" }),
    ];
    const res = convert(rows, { unique: ["emp"] });
    expect(res.rows[1]!.status === "duplicate" || res.rows[1]!.warnings.includes("duplicate")).toBe(true);
  });

  it("case 52/55: multiple unique fields → different date is not a duplicate", () => {
    const rows = [
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Absent", "A M OnDuty": "9:00", "P M OffDuty": "17:00" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "9:00", "P M OffDuty": "17:00" }),
    ];
    const res = convert(rows, { unique: ["emp", "date"] });
    expect(res.rows[1]!.status).toBe("ready");
  });

  it("case 56: no duplicate rule → identical rows are allowed", () => {
    const res = convert(base(), { unique: [] });
    expect(res.rows[0]!.status).toBe("ready");
    expect(res.rows[1]!.status).toBe("ready");
  });
});

describe("Related-date processing (spec §21)", () => {
  it("case 57: same employee, exact next date", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "18:00" }),
    ]);
    expect(val(res.rows[0]!, "out")).toBe("7:00 AM");
  });

  it("case 58: another employee's next-date data is NOT used", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E2", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "18:00" }),
    ]);
    expect(res.rows[0]!.status).toBe("next_day_record_missing");
    expect(val(res.rows[0]!, "out")).toBeNull();
  });

  it("case 59: a gap (14th then 16th) is not treated as the next day", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E1", Date: "16/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "18:00" }),
    ]);
    expect(res.rows[0]!.status).toBe("next_day_record_missing");
  });

  it("case 60: duplicate next-date records → Duplicate Related Record (no auto-pick)", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "18:00" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:05 AM", "P M OffDuty": "18:05" }),
    ]);
    expect(res.rows[0]!.status).toBe("duplicate_related_record");
    expect(val(res.rows[0]!, "out")).toBeNull();
  });

  it("case 61: consecutive overnight records chain correctly", () => {
    const res = convert([
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Not Swipe", "A M OnDuty": "6:00 AM", "P M OffDuty": "9:30 PM" }),
      row({ UserID: "E1", Date: "16/07/2026", "On Desc": "Absent", "A M OnDuty": "6:30 AM", "P M OffDuty": "18:00" }),
    ]);
    expect(val(res.rows[0]!, "out")).toBe("6:00 AM");
    expect(val(res.rows[1]!, "out")).toBe("6:30 AM");
  });

  it("case 62: unsorted source rows still resolve the exact next day", () => {
    const res = convert([
      row({ UserID: "E1", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "18:00" }),
      row({ UserID: "E1", Date: "14/07/2026", "On Desc": "Not Swipe", "P M OffDuty": "9:00 PM" }),
    ]);
    const overnightRow = res.rows.find((r) => r.appliedRuleName === "Overnight Attendance")!;
    expect(val(overnightRow, "out")).toBe("7:00 AM");
  });
});

describe('The "Blank" condition token', () => {
  const dayOnly = () =>
    regularRule({ order: 0, conditions: [{ sourceColumn: "On Desc", operator: "equals", values: ["Absent", "Arrive late", "Blank"] }] });

  it("matches a blank cell — a clocked-in row whose punch-out never registered still converts", () => {
    const res = convert(
      [row({ UserID: "SS812", Date: "27/07/2026", "On Desc": "", "A M OnDuty": "06:36:45", "P M OffDuty": "" })],
      { rules: [dayOnly()] },
    );
    const r = res.rows[0]!;
    expect(r.appliedRuleName).toBe("Regular Attendance");
    expect(val(r, "in")).toBe("06:36:45");
    expect(val(r, "out")).toBeNull();
    expect(r.status).toBe("missing_out_time");
  });

  it("does not over-match: a value that is present but unlisted matches no rule", () => {
    const res = convert(
      [row({ UserID: "SS812", Date: "27/07/2026", "On Desc": "Not Swipe", "A M OnDuty": "06:36:45", "P M OffDuty": "" })],
      { rules: [dayOnly()] },
    );
    expect(res.rows[0]!.appliedRuleName).toBeNull();
    expect(res.rows[0]!.status).toBe("no_matching_rule");
  });

  it("also matches a whitespace-only cell", () => {
    const res = convert(
      [row({ UserID: "SS812", Date: "27/07/2026", "On Desc": "   ", "A M OnDuty": "06:36:45", "P M OffDuty": "18:00" })],
      { rules: [dayOnly()] },
    );
    expect(res.rows[0]!.appliedRuleName).toBe("Regular Attendance");
    expect(res.rows[0]!.status).toBe("ready");
  });
});

describe("Overnight shift by uploaded employee-ID list", () => {
  const rosterRule = () =>
    overnightRule({
      name: "Overnight roster",
      conditions: [{ sourceColumn: "UserID", operator: "in_uploaded_list", values: [] }],
      order: 0,
    });
  const dayRule = () => regularRule({ order: 1 });

  const twoDays = () => [
    row({ UserID: "SS200", Date: "14/07/2026", "On Desc": "", "A M OnDuty": "8:00 PM", "P M OffDuty": "9:00 PM" }),
    row({ UserID: "SS200", Date: "15/07/2026", "On Desc": "", "A M OnDuty": "6:30 AM", "P M OffDuty": "10:00 PM" }),
    row({ UserID: "E900", Date: "14/07/2026", "On Desc": "", "A M OnDuty": "9:00 AM", "P M OffDuty": "6:00 PM" }),
  ];

  it("listed employee takes In from the same day's PM and Out from the next day's AM", () => {
    const res = convert(twoDays(), { rules: [rosterRule(), dayRule()], uploadedList: ["SS200"] });
    const july14 = res.rows[0]!;
    expect(july14.appliedRuleName).toBe("Overnight roster");
    expect(val(july14, "in")).toBe("9:00 PM");
    expect(val(july14, "out")).toBe("6:30 AM");
    expect(val(july14, "date")).toBe("14/07/2026");
    expect(july14.status).toBe("ready");
  });

  it("an employee not on the list keeps normal day-shift handling", () => {
    const res = convert(twoDays(), { rules: [rosterRule(), dayRule()], uploadedList: ["SS200"] });
    const dayRow = res.rows[2]!;
    expect(dayRow.appliedRuleName).toBe("Regular Attendance");
    expect(val(dayRow, "in")).toBe("9:00 AM");
    expect(val(dayRow, "out")).toBe("6:00 PM");
  });

  it("the roster rule beats the day rule even when On Desc would match it", () => {
    const rows = [
      row({ UserID: "SS200", Date: "14/07/2026", "On Desc": "Arrive Late", "A M OnDuty": "8:00 PM", "P M OffDuty": "9:00 PM" }),
      row({ UserID: "SS200", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "6:30 AM" }),
    ];
    const res = convert(rows, { rules: [rosterRule(), dayRule()], uploadedList: ["SS200"] });
    expect(res.rows[0]!.appliedRuleName).toBe("Overnight roster");
    expect(val(res.rows[0]!, "out")).toBe("6:30 AM");
  });

  it("matching ignores case and surrounding spaces", () => {
    const res = convert(twoDays(), { rules: [rosterRule(), dayRule()], uploadedList: ["  ss200 "] });
    expect(res.rows[0]!.appliedRuleName).toBe("Overnight roster");
    expect(val(res.rows[0]!, "in")).toBe("9:00 PM");
  });

  it("without a list the roster rule matches nobody and the day rule applies", () => {
    const res = convert(twoDays(), { rules: [rosterRule(), dayRule()] });
    expect(res.rows.every((r) => r.appliedRuleName !== "Overnight roster")).toBe(true);
    expect(val(res.rows[0]!, "in")).toBe("8:00 PM");
  });

  it("no next-day record keeps Check-In and flags the row for review", () => {
    const res = convert(
      [row({ UserID: "SS200", Date: "14/07/2026", "On Desc": "", "A M OnDuty": "8:00 PM", "P M OffDuty": "9:00 PM" })],
      { rules: [rosterRule(), dayRule()], uploadedList: ["SS200"] },
    );
    const r = res.rows[0]!;
    expect(val(r, "in")).toBe("9:00 PM");
    expect(val(r, "out")).toBeNull();
    expect(r.status).not.toBe("ready");
  });

  it("not_in_uploaded_list inverts the match", () => {
    const res = convert(twoDays(), {
      rules: [
        rosterRule(),
        regularRule({
          order: 1,
          conditions: [{ sourceColumn: "UserID", operator: "not_in_uploaded_list", values: [] }],
        }),
      ],
      uploadedList: ["SS200"],
    });
    expect(res.rows[0]!.appliedRuleName).toBe("Overnight roster");
    expect(res.rows[2]!.appliedRuleName).toBe("Regular Attendance");
  });
});
