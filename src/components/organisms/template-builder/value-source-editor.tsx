"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/ui/select";
import { Input } from "@/components/atoms/ui/input";
import type { RuleValueSource } from "@/lib/engine/types";

type SourceKind = RuleValueSource["type"];

const KIND_LABELS: Record<SourceKind, string> = {
  current_row_column: "a column from the same row",
  next_calendar_day_column: "the same employee's next calendar day",
  previous_calendar_day_column: "the same employee's previous calendar day",
  fixed: "a fixed value",
  combined: "combined columns",
  formula: "an advanced formula",
};

export function ValueSourceEditor({
  value,
  sourceColumns,
  employeeColumn,
  dateColumn,
  onChange,
}: {
  value: RuleValueSource;
  sourceColumns: string[];
  employeeColumn: string;
  dateColumn: string;
  onChange: (v: RuleValueSource) => void;
}) {
  function setKind(kind: SourceKind) {
    if (kind === "current_row_column") onChange({ type: kind, column: sourceColumns[0] ?? "" });
    else if (kind === "next_calendar_day_column" || kind === "previous_calendar_day_column")
      onChange({ type: kind, employeeColumn, dateColumn, returnColumn: sourceColumns[0] ?? "" });
    else if (kind === "fixed") onChange({ type: kind, value: "" });
    else if (kind === "formula") onChange({ type: kind, expression: "" });
    else onChange({ type: "combined", parts: [] });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Use</span>
      <Select value={value.type} onValueChange={(v) => setKind(v as SourceKind)}>
        <SelectTrigger className="h-9 w-auto min-w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current_row_column">{KIND_LABELS.current_row_column}</SelectItem>
          <SelectItem value="next_calendar_day_column">{KIND_LABELS.next_calendar_day_column}</SelectItem>
          <SelectItem value="previous_calendar_day_column">{KIND_LABELS.previous_calendar_day_column}</SelectItem>
          <SelectItem value="fixed">{KIND_LABELS.fixed}</SelectItem>
          <SelectItem value="formula">{KIND_LABELS.formula}</SelectItem>
        </SelectContent>
      </Select>

      {value.type === "current_row_column" && (
        <ColumnSelect
          columns={sourceColumns}
          value={value.column}
          onChange={(c) => onChange({ ...value, column: c })}
        />
      )}

      {(value.type === "next_calendar_day_column" || value.type === "previous_calendar_day_column") && (
        <>
          <span className="text-muted-foreground">taking</span>
          <ColumnSelect
            columns={sourceColumns}
            value={value.returnColumn}
            onChange={(c) => onChange({ ...value, returnColumn: c })}
          />
          <span className="text-xs text-muted-foreground">
            (matched on {employeeColumn || "employee"} + {dateColumn || "date"})
          </span>
        </>
      )}

      {value.type === "fixed" && (
        <Input
          className="h-9 w-40"
          placeholder="value"
          value={value.value}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
        />
      )}

      {value.type === "formula" && (
        <Input
          className="h-9 w-72 font-mono text-xs"
          placeholder="[Column] & ..."
          value={value.expression}
          onChange={(e) => onChange({ ...value, expression: e.target.value })}
        />
      )}
    </div>
  );
}

function ColumnSelect({
  columns,
  value,
  onChange,
}: {
  columns: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[160px]">
        <SelectValue placeholder="choose a column" />
      </SelectTrigger>
      <SelectContent>
        {columns.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
