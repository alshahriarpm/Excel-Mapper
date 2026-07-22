/**
 * Engine type model.
 *
 * This is the heart of the product's core principle:
 *   - The TARGET file defines the final structure and format.
 *   - The SOURCE file provides the data.
 *   - The saved TEMPLATE connects the two.
 *
 * Nothing about attendance is hardcoded here. Column names, conditions,
 * worksheet names, date/time formats and filenames are all data that lives on
 * the template and flows into the engine as configuration.
 */

// ---------------------------------------------------------------------------
// Primitive cell values
// ---------------------------------------------------------------------------

/** A raw value as read from a spreadsheet cell. */
export type CellValue = string | number | boolean | Date | null;

/** One source row: original headers → cell values. Headers are preserved
 *  exactly as they appear in the file (used for display and audit). */
export type SourceRow = Record<string, CellValue>;

// ---------------------------------------------------------------------------
// Matching normalization (how text is compared when matching conditions)
// ---------------------------------------------------------------------------

export type MatchNormalization = {
  /** Ignore upper/lower case when comparing. */
  ignoreCase: boolean;
  /** Trim leading/trailing whitespace. */
  trimSpaces: boolean;
  /** Collapse repeated internal spaces to one. */
  collapseSpaces: boolean;
  /**
   * Alias groups: each group is a set of values treated as equivalent.
   * e.g. ["Absent", "Absect", "Absence"]. The user decides membership.
   */
  aliasGroups?: string[][];
};

export const DEFAULT_NORMALIZATION: MatchNormalization = {
  ignoreCase: true,
  trimSpaces: true,
  collapseSpaces: true,
  aliasGroups: [],
};

// ---------------------------------------------------------------------------
// Value sources — where a computed value (e.g. In Time / Out Time) comes from
// ---------------------------------------------------------------------------

export type RuleValueSource =
  | { type: "current_row_column"; column: string }
  | {
      type: "next_calendar_day_column";
      employeeColumn: string;
      dateColumn: string;
      returnColumn: string;
    }
  | {
      type: "previous_calendar_day_column";
      employeeColumn: string;
      dateColumn: string;
      returnColumn: string;
    }
  | { type: "fixed"; value: string }
  | {
      type: "combined";
      parts: Array<{ kind: "column"; column: string } | { kind: "literal"; text: string }>;
      separator?: string;
    }
  | { type: "formula"; expression: string };

// ---------------------------------------------------------------------------
// Conditions & rules
// ---------------------------------------------------------------------------

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "contains"
  | "not_contains"
  | "is_blank"
  | "is_not_blank"
  | "starts_with"
  | "ends_with";

export type ConversionCondition = {
  sourceColumn: string;
  operator: ConditionOperator;
  /** Values to compare against. Empty for is_blank / is_not_blank. */
  values: string[];
};

export type MissingInTimeBehavior = "blank_both_review" | "exclude";
export type MissingOutTimeBehavior = "keep_in_blank_out_review" | "exclude";

export type ConversionRule = {
  id: string;
  name: string;
  conditions: ConversionCondition[];
  /** How multiple conditions combine. */
  conditionJoin: "and" | "or";
  inTimeSource: RuleValueSource;
  outTimeSource: RuleValueSource;
  missingInTimeBehavior: MissingInTimeBehavior;
  missingOutTimeBehavior: MissingOutTimeBehavior;
  stopAfterMatch: boolean;
  order: number;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Per-target-column mapping
// ---------------------------------------------------------------------------

export type ColumnMapping =
  /** Copy a single source column verbatim. */
  | { kind: "direct"; sourceColumn: string }
  /** Same fixed value for every row. */
  | { kind: "fixed"; value: string }
  /** Concatenate columns and/or literals. */
  | {
      kind: "combined";
      parts: Array<{ kind: "column"; column: string } | { kind: "literal"; text: string }>;
      separator?: string;
    }
  /** Evaluate an advanced formula (power users). */
  | { kind: "formula"; expression: string }
  /** This column receives the matched rule's computed In Time. */
  | { kind: "in_time" }
  /** This column receives the matched rule's computed Out Time. */
  | { kind: "out_time" }
  /** Pull a value from the same employee's next calendar day. */
  | {
      kind: "next_calendar_day_column";
      employeeColumn: string;
      dateColumn: string;
      returnColumn: string;
    }
  /** Column must remain in the output but always stays empty. */
  | { kind: "blank" }
  /** Not yet configured. */
  | { kind: "unmapped" };

export type TargetColumnType =
  | "text"
  | "date"
  | "time"
  | "datetime"
  | "number"
  | "unknown";

export type TargetColumnFormat = {
  /** e.g. "DD/MM/YYYY" — the format used when writing dates. */
  dateFormat?: string;
  /** e.g. "h:mm AM/PM" — the format used when writing times. */
  timeFormat?: string;
  /** e.g. "0.00" — Excel number format. */
  numberFormat?: string;
  /** Keep as text and preserve leading zeros (e.g. "00125"). */
  preserveLeadingZeros?: boolean;
  /** If the target requires a literal placeholder for blank cells. */
  blankPlaceholder?: string;
};

export type BusinessRole = "employee_id" | "date" | "in_time" | "out_time";

export type TargetColumnConfiguration = {
  /** Stable identifier for referencing this column in mappings/rules. */
  key: string;
  /** Exact original header text (e.g. "Employee ID*"). Never altered on output. */
  header: string;
  /** Header without the required marker, for friendly display. */
  displayName: string;
  /** Zero-based position in the target file. Preserved on output. */
  order: number;
  required: boolean;
  detectedType: TargetColumnType;
  /** Sample value detected from the target file (for confirmation UI). */
  sample?: string;
  /** Optional business role assigned by the admin (confirmed, never silent). */
  role?: BusinessRole | null;
  mapping: ColumnMapping;
  format?: TargetColumnFormat;
  /** Excel column width, preserved on output where supported. */
  width?: number;
  hidden?: boolean;
};

// ---------------------------------------------------------------------------
// Target workbook configuration (enough to reconstruct the output file)
// ---------------------------------------------------------------------------

export type TargetFrozenPaneConfiguration = {
  frozenRows?: number;
  frozenColumns?: number;
};

export type TargetWorkbookConfiguration = {
  originalFileName: string;
  originalFileType: "xlsx" | "xls" | "csv";
  /** Base64 snapshot of the original workbook bytes, used to reconstruct the
   *  output with all safe formatting preserved. Optional for CSV. */
  workbookSnapshot?: string;
  worksheetNames: string[];
  /** Name of the worksheet that receives converted data. */
  outputWorksheetName: string;
  /** Zero-based index of the output worksheet. */
  outputWorksheetIndex: number;
  /** 1-based row number of the header row within the output worksheet. */
  headerRowNumber: number;
  /** Rows that appear above the header (instructions etc.), preserved verbatim. */
  staticRowsAboveHeader: CellValue[][];
  columns: TargetColumnConfiguration[];
  frozenPane?: TargetFrozenPaneConfiguration;
  /** Template for the output filename, e.g. "{name}_{company}_{period}". */
  outputFileNamePattern?: string;
};

// ---------------------------------------------------------------------------
// Source configuration
// ---------------------------------------------------------------------------

export type SourceConfiguration = {
  expectedWorksheetName?: string;
  expectedHeaderRow: number;
  /** Original source headers expected by the template (for drift detection). */
  expectedColumns: string[];
  /** Source column that identifies the employee. */
  employeeColumn: string;
  /** Source column that holds the attendance date. */
  dateColumn: string;
  /** Source column that holds the attendance condition/note (optional). */
  conditionColumn?: string;
  /** Hint for parsing ambiguous dates, e.g. "DD/MM/YYYY". */
  sourceDateFormat?: string;
  normalization: MatchNormalization;
};

// ---------------------------------------------------------------------------
// Output configuration
// ---------------------------------------------------------------------------

export type OutputExportMode = "all" | "valid_only" | "include_incomplete";

export type OutputConfiguration = {
  defaultExportMode: OutputExportMode;
  /** Optional filename affixes the user may enable. */
  affixes?: {
    companyName?: string;
    conversionDate?: boolean;
    sourcePeriod?: string;
    version?: boolean;
  };
};

// ---------------------------------------------------------------------------
// The saved template (the bridge between target and source)
// ---------------------------------------------------------------------------

export type TemplateStatus = "draft" | "active" | "inactive";

export type SavedConversionTemplate = {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  targetConfiguration: TargetWorkbookConfiguration;
  sourceConfiguration: SourceConfiguration;
  rules: ConversionRule[];
  defaultRule?: ConversionRule | null;
  /** Target column keys that together must be unique (duplicate rule). */
  uniqueTargetFields: string[];
  outputConfiguration: OutputConfiguration;
  status: TemplateStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Engine results
// ---------------------------------------------------------------------------

export type RowStatus =
  | "ready"
  | "missing_in_time"
  | "missing_out_time"
  | "next_day_record_missing"
  | "duplicate_related_record"
  | "no_matching_rule"
  | "multiple_rules_matched"
  | "missing_required_value"
  | "duplicate"
  | "excluded";

/** Where a single output cell's value came from — for full traceability. */
export type CellProvenance = {
  /** Human-readable description, e.g. "Current row → A M OnDuty". */
  description: string;
  sourceColumn?: string;
  /** Zero-based index of the source row the value came from. */
  sourceRowIndex?: number;
  /** The original, untouched source value. */
  originalValue?: CellValue;
};

export type ConvertedCell = {
  columnKey: string;
  /** Final formatted value written to the output file. */
  value: CellValue;
  provenance: CellProvenance;
};

export type UserCorrection = {
  columnKey: string;
  originalValue: CellValue;
  correctedValue: CellValue;
  reason?: string;
  correctedBy?: string;
  correctedAt?: string;
};

export type ConvertedRow = {
  /** Zero-based index of the source row that produced this record. */
  sourceRowIndex: number;
  /** The matched rule's id/name, or null if none matched. */
  appliedRuleId: string | null;
  appliedRuleName: string | null;
  cells: Record<string, ConvertedCell>;
  status: RowStatus;
  /** Additional warnings that don't override the primary status. */
  warnings: RowStatus[];
  corrections: UserCorrection[];
  excluded: boolean;
};

export type ConversionIssue = {
  sourceRowIndex: number;
  status: RowStatus;
  /** Plain-language explanation of what happened. */
  message: string;
  /** Plain-language suggestion of how to fix it. */
  suggestion?: string;
};

export type ConversionResult = {
  rows: ConvertedRow[];
  issues: ConversionIssue[];
  summary: {
    total: number;
    ready: number;
    missingInTime: number;
    missingOutTime: number;
    nextDayRecordMissing: number;
    noMatchingRule: number;
    multipleRulesMatched: number;
    duplicate: number;
    excluded: number;
  };
  /** Duplicate employee-date rows detected in the source (before rule apply). */
  duplicateSourceKeys: string[];
};

export type ConfigurableAttendanceTransformInput = {
  sourceRows: SourceRow[];
  targetConfiguration: TargetWorkbookConfiguration;
  sourceConfiguration: SourceConfiguration;
  rules: ConversionRule[];
  defaultRule?: ConversionRule | null;
  uniqueTargetFields: string[];
};
