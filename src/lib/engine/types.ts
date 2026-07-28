

export type CellValue = string | number | boolean | Date | null;

export type SourceRow = Record<string, CellValue>;


export type MatchNormalization = {
  ignoreCase: boolean;
  trimSpaces: boolean;
  collapseSpaces: boolean;
  aliasGroups?: string[][];
};

export const DEFAULT_NORMALIZATION: MatchNormalization = {
  ignoreCase: true,
  trimSpaces: true,
  collapseSpaces: true,
  aliasGroups: [],
};


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
  values: string[];
};

export type MissingInTimeBehavior = "blank_both_review" | "exclude";
export type MissingOutTimeBehavior = "keep_in_blank_out_review" | "exclude";

export type ConversionRule = {
  id: string;
  name: string;
  conditions: ConversionCondition[];
  conditionJoin: "and" | "or";
  inTimeSource: RuleValueSource;
  outTimeSource: RuleValueSource;
  missingInTimeBehavior: MissingInTimeBehavior;
  missingOutTimeBehavior: MissingOutTimeBehavior;
  stopAfterMatch: boolean;
  order: number;
  active: boolean;
};


export type ColumnMapping =
  | { kind: "direct"; sourceColumn: string }
  | { kind: "fixed"; value: string }
  | {
      kind: "combined";
      parts: Array<{ kind: "column"; column: string } | { kind: "literal"; text: string }>;
      separator?: string;
    }
  | { kind: "formula"; expression: string }
  | { kind: "in_time" }
  | { kind: "out_time" }
  | {
      kind: "next_calendar_day_column";
      employeeColumn: string;
      dateColumn: string;
      returnColumn: string;
    }
  | { kind: "blank" }
  | { kind: "unmapped" };

export type TargetColumnType =
  | "text"
  | "date"
  | "time"
  | "datetime"
  | "number"
  | "unknown";

export type TargetColumnFormat = {
  dateFormat?: string;
  timeFormat?: string;
  numberFormat?: string;
  preserveLeadingZeros?: boolean;
  blankPlaceholder?: string;
};

export type BusinessRole = "employee_id" | "date" | "in_time" | "out_time";

export type TargetColumnConfiguration = {
  key: string;
  header: string;
  displayName: string;
  order: number;
  required: boolean;
  detectedType: TargetColumnType;
  sample?: string;
  role?: BusinessRole | null;
  mapping: ColumnMapping;
  format?: TargetColumnFormat;
  width?: number;
  hidden?: boolean;
};


export type TargetFrozenPaneConfiguration = {
  frozenRows?: number;
  frozenColumns?: number;
};

export type TargetWorkbookConfiguration = {
  originalFileName: string;
  originalFileType: "xlsx" | "xls" | "csv";
  workbookSnapshot?: string;
  worksheetNames: string[];
  outputWorksheetName: string;
  outputWorksheetIndex: number;
  headerRowNumber: number;
  staticRowsAboveHeader: CellValue[][];
  columns: TargetColumnConfiguration[];
  frozenPane?: TargetFrozenPaneConfiguration;
  outputFileNamePattern?: string;
};


export type SourceConfiguration = {
  expectedWorksheetName?: string;
  expectedHeaderRow: number;
  expectedColumns: string[];
  employeeColumn: string;
  dateColumn: string;
  conditionColumn?: string;
  sourceDateFormat?: string;
  normalization: MatchNormalization;
};


export type OutputExportMode = "all" | "valid_only" | "include_incomplete";

export type OutputConfiguration = {
  defaultExportMode: OutputExportMode;
  affixes?: {
    companyName?: string;
    conversionDate?: boolean;
    sourcePeriod?: string;
    version?: boolean;
  };
};


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
  uniqueTargetFields: string[];
  outputConfiguration: OutputConfiguration;
  status: TemplateStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};


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

export type CellProvenance = {
  description: string;
  sourceColumn?: string;
  sourceRowIndex?: number;
  originalValue?: CellValue;
};

export type ConvertedCell = {
  columnKey: string;
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
  sourceRowIndex: number;
  appliedRuleId: string | null;
  appliedRuleName: string | null;
  cells: Record<string, ConvertedCell>;
  status: RowStatus;
  warnings: RowStatus[];
  corrections: UserCorrection[];
  excluded: boolean;
};

export type ConversionIssue = {
  sourceRowIndex: number;
  status: RowStatus;
  message: string;
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
