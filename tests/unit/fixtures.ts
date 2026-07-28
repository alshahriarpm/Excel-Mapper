import type {
  ConversionRule,
  SavedConversionTemplate,
  SourceConfiguration,
  SourceRow,
  TargetColumnConfiguration,
  TargetWorkbookConfiguration,
} from "@/lib/engine/types";
import { DEFAULT_NORMALIZATION } from "@/lib/engine/types";

export function targetColumns(): TargetColumnConfiguration[] {
  return [
    {
      key: "emp",
      header: "Employee ID*",
      displayName: "Employee ID",
      order: 0,
      required: true,
      detectedType: "text",
      role: "employee_id",
      mapping: { kind: "direct", sourceColumn: "UserID" },
      format: { preserveLeadingZeros: true },
    },
    {
      key: "date",
      header: "Date*",
      displayName: "Date",
      order: 1,
      required: true,
      detectedType: "date",
      role: "date",
      mapping: { kind: "direct", sourceColumn: "Date" },
      format: { dateFormat: "DD/MM/YYYY" },
    },
    {
      key: "in",
      header: "In Time*",
      displayName: "In Time",
      order: 2,
      required: true,
      detectedType: "time",
      role: "in_time",
      mapping: { kind: "in_time" },
      format: { timeFormat: "h:mm AM/PM" },
    },
    {
      key: "out",
      header: "Out Time*",
      displayName: "Out Time",
      order: 3,
      required: true,
      detectedType: "time",
      role: "out_time",
      mapping: { kind: "out_time" },
      format: { timeFormat: "h:mm AM/PM" },
    },
  ];
}

export function targetConfiguration(
  overrides: Partial<TargetWorkbookConfiguration> = {},
): TargetWorkbookConfiguration {
  return {
    originalFileName: "Attendance Bulk Upload.xlsx",
    originalFileType: "xlsx",
    worksheetNames: ["Attendance"],
    outputWorksheetName: "Attendance",
    outputWorksheetIndex: 0,
    headerRowNumber: 1,
    staticRowsAboveHeader: [],
    columns: targetColumns(),
    ...overrides,
  };
}

export function sourceConfiguration(
  overrides: Partial<SourceConfiguration> = {},
): SourceConfiguration {
  return {
    expectedHeaderRow: 1,
    expectedColumns: ["UserID", "Date", "On Desc", "A M OnDuty", "P M OffDuty"],
    employeeColumn: "UserID",
    dateColumn: "Date",
    conditionColumn: "On Desc",
    sourceDateFormat: "DD/MM/YYYY",
    normalization: { ...DEFAULT_NORMALIZATION },
    ...overrides,
  };
}

export function regularRule(overrides: Partial<ConversionRule> = {}): ConversionRule {
  return {
    id: "regular",
    name: "Regular Attendance",
    conditions: [
      {
        sourceColumn: "On Desc",
        operator: "in",
        values: ["Absent", "Absect", "Arrive Late", ""],
      },
    ],
    conditionJoin: "and",
    inTimeSource: { type: "current_row_column", column: "A M OnDuty" },
    outTimeSource: { type: "current_row_column", column: "P M OffDuty" },
    missingInTimeBehavior: "blank_both_review",
    missingOutTimeBehavior: "keep_in_blank_out_review",
    stopAfterMatch: true,
    order: 1,
    active: true,
    ...overrides,
  };
}

export function overnightRule(overrides: Partial<ConversionRule> = {}): ConversionRule {
  return {
    id: "overnight",
    name: "Overnight Attendance",
    conditions: [{ sourceColumn: "On Desc", operator: "equals", values: ["Not Swipe"] }],
    conditionJoin: "and",
    inTimeSource: { type: "current_row_column", column: "P M OffDuty" },
    outTimeSource: {
      type: "next_calendar_day_column",
      employeeColumn: "UserID",
      dateColumn: "Date",
      returnColumn: "A M OnDuty",
    },
    missingInTimeBehavior: "blank_both_review",
    missingOutTimeBehavior: "keep_in_blank_out_review",
    stopAfterMatch: true,
    order: 0,
    active: true,
    ...overrides,
  };
}

export type Row = {
  UserID?: string | number | null;
  Date?: string | null;
  "On Desc"?: string | null;
  "A M OnDuty"?: string | null;
  "P M OffDuty"?: string | null;
  [k: string]: string | number | null | undefined;
};

export function row(r: Row): SourceRow {
  return r as SourceRow;
}

export function fullTemplate(): SavedConversionTemplate {
  return {
    id: "tpl-1",
    companyId: "company-a",
    name: "Attendance Import",
    targetConfiguration: targetConfiguration(),
    sourceConfiguration: sourceConfiguration(),
    rules: [overnightRule(), regularRule()],
    defaultRule: null,
    uniqueTargetFields: ["emp", "date"],
    outputConfiguration: { defaultExportMode: "all" },
    status: "active",
    version: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}
