/**
 * The configurable attendance transform.
 *
 * Everything is configuration-driven. The processor:
 *   1. reads mappings from the template,
 *   2. builds the employee-date index from the configured columns,
 *   3. matches rules in saved order,
 *   4. computes In Time FIRST, applies missing-In behavior,
 *   5. computes Out Time only when allowed (blank In → blank Out, always),
 *   6. applies missing-Out behavior,
 *   7. tracks source-cell provenance,
 *   8. validates the configured unique target fields,
 *   9. returns converted rows + plain-language issues.
 *
 * No source or target column name, condition value, or format is hardcoded.
 */
import type {
  CellProvenance,
  CellValue,
  ColumnMapping,
  ConfigurableAttendanceTransformInput,
  ConversionCondition,
  ConversionResult,
  ConversionRule,
  ConvertedCell,
  ConvertedRow,
  RowStatus,
  RuleValueSource,
  SourceRow,
  TargetColumnConfiguration,
} from "./types";
import {
  canonicalAlias,
  cellToString,
  isBlank,
  normalizeForMatch,
  normalizeHeader,
} from "./normalize";
import { buildEmployeeDateIndex, type LookupOutcome } from "./employeeDateIndex";
import { compileFormula, type FormulaContext } from "./formulaEngine";

// Severity order — first match wins as the row's primary status.
const STATUS_PRIORITY: RowStatus[] = [
  "excluded",
  "no_matching_rule",
  "missing_required_value",
  "missing_in_time",
  "next_day_record_missing",
  "duplicate_related_record",
  "missing_out_time",
  "multiple_rules_matched",
  "duplicate",
  "ready",
];

function pickPrimary(flags: Set<RowStatus>): {
  primary: RowStatus;
  warnings: RowStatus[];
} {
  const ordered = STATUS_PRIORITY.filter((s) => flags.has(s));
  const primary = ordered[0] ?? "ready";
  return { primary, warnings: ordered.slice(1).filter((s) => s !== "ready") };
}

/** Build a resolver that maps a requested column name to the actual row key. */
function makeColumnResolver(sourceRows: SourceRow[]): (name: string) => string | undefined {
  const map = new Map<string, string>();
  for (const row of sourceRows) {
    for (const key of Object.keys(row)) {
      const norm = normalizeHeader(key);
      if (!map.has(norm)) map.set(norm, key);
    }
  }
  return (name: string) => map.get(normalizeHeader(name));
}

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

function conditionMatches(
  cond: ConversionCondition,
  row: SourceRow,
  resolveColumn: (name: string) => string | undefined,
  normalization: ConfigurableAttendanceTransformInput["sourceConfiguration"]["normalization"],
): boolean {
  const key = resolveColumn(cond.sourceColumn);
  const value: CellValue = key ? (row[key] ?? null) : null;

  if (cond.operator === "is_blank") return isBlank(value);
  if (cond.operator === "is_not_blank") return !isBlank(value);

  const nv = canonicalAlias(value, normalization);
  const targets = cond.values.map((v) => canonicalAlias(v, normalization));
  // A values entry of "" or "blank" is treated as "the cell is empty".
  const blankIntended = cond.values.some((v) => {
    const c = normalizeForMatch(v, normalization);
    return c === "" || c === "blank";
  });

  switch (cond.operator) {
    case "equals":
      return targets.includes(nv) || (blankIntended && isBlank(value));
    case "not_equals":
      return !(targets.includes(nv) || (blankIntended && isBlank(value)));
    case "in":
      return targets.includes(nv) || (blankIntended && isBlank(value));
    case "contains":
      return targets.some((t) => t !== "" && nv.includes(t));
    case "not_contains":
      return !targets.some((t) => t !== "" && nv.includes(t));
    case "starts_with":
      return targets.some((t) => t !== "" && nv.startsWith(t));
    case "ends_with":
      return targets.some((t) => t !== "" && nv.endsWith(t));
    default:
      return false;
  }
}

function ruleMatches(
  rule: ConversionRule,
  row: SourceRow,
  resolveColumn: (name: string) => string | undefined,
  normalization: ConfigurableAttendanceTransformInput["sourceConfiguration"]["normalization"],
): boolean {
  if (rule.conditions.length === 0) return true; // no conditions = catch-all
  const results = rule.conditions.map((c) => conditionMatches(c, row, resolveColumn, normalization));
  return rule.conditionJoin === "or" ? results.some(Boolean) : results.every(Boolean);
}

// ---------------------------------------------------------------------------
// Value-source resolution
// ---------------------------------------------------------------------------

type ResolvedValue = {
  value: CellValue;
  provenance: CellProvenance;
  outcome: LookupOutcome | "ok";
};

function makeFormulaContext(
  row: SourceRow,
  resolveColumn: (name: string) => string | undefined,
  index: ReturnType<typeof buildEmployeeDateIndex>,
): FormulaContext {
  return {
    getColumn: (name) => {
      const key = resolveColumn(name);
      return key ? (row[key] ?? null) : null;
    },
    lookupCalendarDay: (employeeColumn, dateColumn, returnColumn, offsetDays) => {
      const empKey = resolveColumn(employeeColumn);
      const dateKey = resolveColumn(dateColumn);
      const res = index.lookup(
        empKey ? (row[empKey] ?? null) : null,
        dateKey ? (row[dateKey] ?? null) : null,
        returnColumn,
        offsetDays,
      );
      return res.value;
    },
  };
}

function resolveValueSource(
  source: RuleValueSource,
  row: SourceRow,
  resolveColumn: (name: string) => string | undefined,
  index: ReturnType<typeof buildEmployeeDateIndex>,
): ResolvedValue {
  switch (source.type) {
    case "current_row_column": {
      const key = resolveColumn(source.column);
      const value = key ? (row[key] ?? null) : null;
      return {
        value,
        outcome: "ok",
        provenance: {
          description: `Current row → ${source.column}`,
          sourceColumn: source.column,
          originalValue: value,
        },
      };
    }
    case "fixed":
      return {
        value: source.value,
        outcome: "ok",
        provenance: { description: `Fixed value "${source.value}"` },
      };
    case "combined": {
      const sep = source.separator ?? "";
      const text = source.parts
        .map((p) =>
          p.kind === "literal"
            ? p.text
            : cellToString(resolveColumn(p.column) ? (row[resolveColumn(p.column)!] ?? null) : null),
        )
        .join(sep);
      return {
        value: text,
        outcome: "ok",
        provenance: { description: "Combined columns" },
      };
    }
    case "formula": {
      const value = compileFormula(source.expression)(
        makeFormulaContext(row, resolveColumn, index),
      );
      return {
        value,
        outcome: "ok",
        provenance: { description: `Formula: ${source.expression}` },
      };
    }
    case "next_calendar_day_column":
    case "previous_calendar_day_column": {
      const offset = source.type === "next_calendar_day_column" ? 1 : -1;
      const empKey = resolveColumn(source.employeeColumn);
      const dateKey = resolveColumn(source.dateColumn);
      const res = index.lookup(
        empKey ? (row[empKey] ?? null) : null,
        dateKey ? (row[dateKey] ?? null) : null,
        source.returnColumn,
        offset,
      );
      const relation = offset === 1 ? "Next calendar date" : "Previous calendar date";
      return {
        value: res.value,
        outcome: res.outcome,
        provenance: {
          description: `Same employee's ${relation.toLowerCase()} → ${source.returnColumn}`,
          sourceColumn: source.returnColumn,
          sourceRowIndex: res.relatedRowIndex,
          originalValue: res.value,
        },
      };
    }
    default:
      return { value: null, outcome: "ok", provenance: { description: "Unknown" } };
  }
}

// ---------------------------------------------------------------------------
// Column mapping resolution (non-time columns)
// ---------------------------------------------------------------------------

function resolveColumnMapping(
  mapping: ColumnMapping,
  row: SourceRow,
  resolveColumn: (name: string) => string | undefined,
  index: ReturnType<typeof buildEmployeeDateIndex>,
): ResolvedValue | null {
  switch (mapping.kind) {
    case "direct":
      return resolveValueSource({ type: "current_row_column", column: mapping.sourceColumn }, row, resolveColumn, index);
    case "fixed":
      return resolveValueSource({ type: "fixed", value: mapping.value }, row, resolveColumn, index);
    case "combined":
      return resolveValueSource(
        { type: "combined", parts: mapping.parts, separator: mapping.separator },
        row,
        resolveColumn,
        index,
      );
    case "formula":
      return resolveValueSource({ type: "formula", expression: mapping.expression }, row, resolveColumn, index);
    case "next_calendar_day_column":
      return resolveValueSource(
        {
          type: "next_calendar_day_column",
          employeeColumn: mapping.employeeColumn,
          dateColumn: mapping.dateColumn,
          returnColumn: mapping.returnColumn,
        },
        row,
        resolveColumn,
        index,
      );
    case "blank":
      return { value: null, outcome: "ok", provenance: { description: "Intentionally blank" } };
    case "in_time":
    case "out_time":
    case "unmapped":
      // Handled by the rule engine / not yet configured.
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

export function runConfigurableAttendanceTransform(
  input: ConfigurableAttendanceTransformInput,
): ConversionResult {
  const { sourceRows, targetConfiguration, sourceConfiguration, rules, defaultRule, uniqueTargetFields } = input;
  const normalization = sourceConfiguration.normalization;
  const resolveColumn = makeColumnResolver(sourceRows);

  const index = buildEmployeeDateIndex(
    sourceRows,
    sourceConfiguration.employeeColumn,
    sourceConfiguration.dateColumn,
    normalization,
    resolveColumn,
    sourceConfiguration.sourceDateFormat,
  );

  const activeRules = rules
    .filter((r) => r.active)
    .slice()
    .sort((a, b) => a.order - b.order);

  const targetColumns = targetConfiguration.columns.slice().sort((a, b) => a.order - b.order);
  const inTimeColumn = targetColumns.find((c) => c.mapping.kind === "in_time" || c.role === "in_time");
  const outTimeColumn = targetColumns.find((c) => c.mapping.kind === "out_time" || c.role === "out_time");

  const rows: ConvertedRow[] = [];

  sourceRows.forEach((row, sourceRowIndex) => {
    const flags = new Set<RowStatus>();

    // --- Rule selection (in saved order) ---------------------------------
    let appliedRule: ConversionRule | null = null;
    let additionalMatches = 0;
    for (const rule of activeRules) {
      if (ruleMatches(rule, row, resolveColumn, normalization)) {
        if (!appliedRule) {
          appliedRule = rule;
          if (rule.stopAfterMatch) break;
        } else {
          additionalMatches++;
        }
      }
    }
    if (!appliedRule && defaultRule && defaultRule.active) {
      appliedRule = defaultRule;
    }
    if (!appliedRule) flags.add("no_matching_rule");
    if (additionalMatches > 0) flags.add("multiple_rules_matched");

    // --- In Time first, then Out Time ------------------------------------
    let inValue: CellValue = null;
    let outValue: CellValue = null;
    let inProvenance: CellProvenance = { description: "Not calculated" };
    let outProvenance: CellProvenance = { description: "Not calculated" };
    let excluded = false;

    if (appliedRule) {
      const inRes = resolveValueSource(appliedRule.inTimeSource, row, resolveColumn, index);
      inProvenance = inRes.provenance;
      if (isBlank(inRes.value)) {
        if (appliedRule.missingInTimeBehavior === "exclude") {
          excluded = true;
          flags.add("excluded");
        } else {
          flags.add("missing_in_time");
        }
        inValue = null;
        outValue = null; // blank In ALWAYS forces blank Out
        outProvenance = { description: "Forced blank (no In Time)" };
      } else {
        inValue = inRes.value;
        const outRes = resolveValueSource(appliedRule.outTimeSource, row, resolveColumn, index);
        outProvenance = outRes.provenance;
        if (isBlank(outRes.value)) {
          if (appliedRule.missingOutTimeBehavior === "exclude") {
            excluded = true;
            flags.add("excluded");
          } else if (outRes.outcome === "no_related_row") {
            flags.add("next_day_record_missing");
          } else if (outRes.outcome === "duplicate") {
            flags.add("duplicate_related_record");
          } else {
            flags.add("missing_out_time");
          }
          outValue = null;
        } else {
          outValue = outRes.value;
        }
      }
    }

    // --- Build every target cell -----------------------------------------
    const cells: Record<string, ConvertedCell> = {};
    for (const col of targetColumns) {
      let cellValue: CellValue = null;
      let provenance: CellProvenance = { description: "Empty" };

      if (col === inTimeColumn) {
        cellValue = inValue;
        provenance = inProvenance;
      } else if (col === outTimeColumn) {
        cellValue = outValue;
        provenance = outProvenance;
      } else {
        const resolved = resolveColumnMapping(col.mapping, row, resolveColumn, index);
        if (resolved) {
          cellValue = resolved.value;
          provenance = resolved.provenance;
        }
      }

      cellValue = applyTextFormat(cellValue, col);
      cells[col.key] = { columnKey: col.key, value: cellValue, provenance };
    }

    // --- Enforce the invariant once more at the cell level ---------------
    if (inTimeColumn && outTimeColumn) {
      const inCell = cells[inTimeColumn.key];
      const outCell = cells[outTimeColumn.key];
      if (inCell && outCell && isBlank(inCell.value) && !isBlank(outCell.value)) {
        outCell.value = null;
        outCell.provenance = { description: "Forced blank (no In Time)" };
      }
    }

    // --- Required-value check (non time-specific) ------------------------
    if (appliedRule && !excluded) {
      for (const col of targetColumns) {
        if (!col.required) continue;
        if (col === inTimeColumn || col === outTimeColumn) continue; // own statuses
        if (isBlank(cells[col.key]?.value ?? null)) {
          flags.add("missing_required_value");
          break;
        }
      }
    }

    const { primary, warnings } = pickPrimary(flags);
    rows.push({
      sourceRowIndex,
      appliedRuleId: appliedRule?.id ?? null,
      appliedRuleName: appliedRule?.name ?? null,
      cells,
      status: primary,
      warnings,
      corrections: [],
      excluded,
    });
  });

  // --- Duplicate validation on configured unique target fields ------------
  if (uniqueTargetFields.length > 0) {
    const seen = new Map<string, number>();
    rows.forEach((r) => {
      if (r.excluded) return;
      const composite = uniqueTargetFields
        .map((k) => normalizeForMatch(r.cells[k]?.value ?? null, normalization))
        .join(" ␟ "); // unit separator to avoid accidental collisions
      const count = seen.get(composite) ?? 0;
      if (count >= 1) {
        if (r.status === "ready") {
          r.status = "duplicate";
        } else if (!r.warnings.includes("duplicate")) {
          r.warnings.push("duplicate");
        }
      }
      seen.set(composite, count + 1);
    });
  }

  return {
    rows,
    issues: buildIssues(rows, targetColumns),
    summary: summarize(rows),
    duplicateSourceKeys: index.duplicateKeys,
  };
}

// ---------------------------------------------------------------------------
// Output text formatting (leading zeros, blank placeholders).
// Date/time/number *display* formatting is applied by the target generator
// using the target file's own formats.
// ---------------------------------------------------------------------------

function applyTextFormat(value: CellValue, col: TargetColumnConfiguration): CellValue {
  if (isBlank(value)) {
    return col.format?.blankPlaceholder ?? null;
  }
  if (col.format?.preserveLeadingZeros && typeof value !== "object") {
    return cellToString(value);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Issues & summary
// ---------------------------------------------------------------------------

const ISSUE_COPY: Record<RowStatus, { message: string; suggestion?: string }> = {
  ready: { message: "Ready" },
  missing_in_time: {
    message: "We couldn't find a Check-In time for this record.",
    suggestion: "Check the source column, or mark it for review.",
  },
  missing_out_time: {
    message: "We found a Check-In time but no Check-Out time.",
    suggestion: "Keep the Check-In and review the Check-Out, or exclude the record.",
  },
  next_day_record_missing: {
    message: "The next day's record for this employee is missing.",
    suggestion: "The Check-Out could not be pulled from the following day.",
  },
  duplicate_related_record: {
    message: "More than one next-day record exists for this employee.",
    suggestion: "We won't guess which one to use — please clean up the duplicates.",
  },
  no_matching_rule: {
    message: "No rule matched this record.",
    suggestion: "Add a rule for this case, or set a default rule.",
  },
  multiple_rules_matched: {
    message: "More than one rule matched this record.",
    suggestion: "Reorder the rules or turn on “stop after match”.",
  },
  missing_required_value: {
    message: "A required field is empty for this record.",
    suggestion: "Fill in the missing value or fix the source column.",
  },
  duplicate: {
    message: "This record duplicates another one.",
    suggestion: "Remove or correct the duplicate before downloading.",
  },
  excluded: { message: "This record was excluded by the rules." },
};

function buildIssues(rows: ConvertedRow[], _targetColumns: TargetColumnConfiguration[]) {
  const issues: ConversionResult["issues"] = [];
  for (const r of rows) {
    if (r.status === "ready") continue;
    const copy = ISSUE_COPY[r.status];
    issues.push({
      sourceRowIndex: r.sourceRowIndex,
      status: r.status,
      message: copy.message,
      suggestion: copy.suggestion,
    });
  }
  return issues;
}

export function summarize(rows: ConvertedRow[]): ConversionResult["summary"] {
  const has = (r: ConvertedRow, s: RowStatus) => r.status === s || r.warnings.includes(s);
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    missingInTime: rows.filter((r) => r.status === "missing_in_time").length,
    missingOutTime: rows.filter((r) => r.status === "missing_out_time").length,
    nextDayRecordMissing: rows.filter((r) => r.status === "next_day_record_missing").length,
    noMatchingRule: rows.filter((r) => r.status === "no_matching_rule").length,
    multipleRulesMatched: rows.filter((r) => has(r, "multiple_rules_matched")).length,
    duplicate: rows.filter((r) => has(r, "duplicate")).length,
    excluded: rows.filter((r) => r.excluded).length,
  };
}
