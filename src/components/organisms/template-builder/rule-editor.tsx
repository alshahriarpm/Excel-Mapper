"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/ui/card";
import { Input } from "@/components/atoms/ui/input";
import { Button } from "@/components/atoms/ui/button";
import { Switch } from "@/components/atoms/ui/switch";
import { Label } from "@/components/atoms/ui/label";
import { Separator } from "@/components/atoms/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/atoms/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/ui/select";
import { ValueSourceEditor } from "./value-source-editor";
import type { ConditionOperator, ConversionCondition, ConversionRule } from "@/lib/engine/types";

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "is equal to",
  not_equals: "is not equal to",
  in: "is one of these values",
  in_uploaded_list: "is in the list HR uploads",
  not_in_uploaded_list: "is not in the list HR uploads",
  contains: "contains",
  not_contains: "does not contain",
  is_blank: "is blank",
  is_not_blank: "is not blank",
  starts_with: "starts with",
  ends_with: "ends with",
};

const USES_UPLOADED_LIST: ConditionOperator[] = ["in_uploaded_list", "not_in_uploaded_list"];

const NEEDS_VALUES: ConditionOperator[] = [
  "equals",
  "not_equals",
  "in",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
];

export function RuleEditor({
  rule,
  sourceColumns,
  employeeColumn,
  dateColumn,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  rule: ConversionRule;
  sourceColumns: string[];
  employeeColumn: string;
  dateColumn: string;
  index: number;
  total: number;
  onChange: (rule: ConversionRule) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  function updateCondition(i: number, patch: Partial<ConversionCondition>) {
    const conditions = rule.conditions.map((c, ci) => (ci === i ? { ...c, ...patch } : c));
    onChange({ ...rule, conditions });
  }

  return (
    <Card className={rule.active ? "" : "opacity-60"}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium">
            {index + 1}
          </span>
          <Input
            className="h-9 max-w-xs font-medium"
            value={rule.name}
            placeholder="Rule name"
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
          />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Delete rule">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-secondary/40 p-3">
          {rule.conditions.length === 0 && (
            <p className="text-sm text-muted-foreground">Applies to every row (no conditions).</p>
          )}
          {rule.conditions.map((cond, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{i === 0 ? "When" : rule.conditionJoin === "and" ? "and" : "or"}</span>
              <Select value={cond.sourceColumn} onValueChange={(v) => updateCondition(i, { sourceColumn: v })}>
                <SelectTrigger className="h-9 w-auto min-w-[150px]"><SelectValue placeholder="column" /></SelectTrigger>
                <SelectContent>
                  {sourceColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cond.operator} onValueChange={(v) => updateCondition(i, { operator: v as ConditionOperator })}>
                <SelectTrigger className="h-9 w-auto min-w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
                    <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {NEEDS_VALUES.includes(cond.operator) && (
                <Input
                  className="h-9 w-56"
                  placeholder="values, comma-separated"
                  value={cond.values.join(", ")}
                  onChange={(e) => updateCondition(i, { values: e.target.value.split(",").map((s) => s.trim()) })}
                />
              )}
              {USES_UPLOADED_LIST.includes(cond.operator) && (
                <span className="text-xs text-muted-foreground">
                  (HR supplies this list when they convert)
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ ...rule, conditions: rule.conditions.filter((_, ci) => ci !== i) })}
                aria-label="Remove condition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...rule,
                  conditions: [...rule.conditions, { sourceColumn: sourceColumns[0] ?? "", operator: "equals", values: [] }],
                })
              }
            >
              Add condition
            </Button>
            {rule.conditions.length > 1 && (
              <Select value={rule.conditionJoin} onValueChange={(v) => onChange({ ...rule, conditionJoin: v as "and" | "or" })}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">Match all</SelectItem>
                  <SelectItem value="or">Match any</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">For Check-In</Label>
            <ValueSourceEditor
              value={rule.inTimeSource}
              sourceColumns={sourceColumns}
              employeeColumn={employeeColumn}
              dateColumn={dateColumn}
              onChange={(v) => onChange({ ...rule, inTimeSource: v })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">For Check-Out</Label>
            <ValueSourceEditor
              value={rule.outTimeSource}
              sourceColumns={sourceColumns}
              employeeColumn={employeeColumn}
              dateColumn={dateColumn}
              onChange={(v) => onChange({ ...rule, outTimeSource: v })}
            />
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">If Check-In is missing</Label>
            <RadioGroup
              value={rule.missingInTimeBehavior}
              onValueChange={(v) => onChange({ ...rule, missingInTimeBehavior: v as ConversionRule["missingInTimeBehavior"] })}
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="blank_both_review" /> Leave both blank &amp; mark for review
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="exclude" /> Exclude the record
              </label>
            </RadioGroup>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">If Check-Out is missing</Label>
            <RadioGroup
              value={rule.missingOutTimeBehavior}
              onValueChange={(v) => onChange({ ...rule, missingOutTimeBehavior: v as ConversionRule["missingOutTimeBehavior"] })}
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="keep_in_blank_out_review" /> Keep Check-In, blank Check-Out &amp; review
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="exclude" /> Exclude the record
              </label>
            </RadioGroup>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={rule.stopAfterMatch} onCheckedChange={(c) => onChange({ ...rule, stopAfterMatch: c })} />
            Stop checking other rules after this matches
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={rule.active} onCheckedChange={(c) => onChange({ ...rule, active: c })} />
            Active
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
