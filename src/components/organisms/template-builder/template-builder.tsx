"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { Input } from "@/components/atoms/ui/input";
import { Textarea } from "@/components/atoms/ui/textarea";
import { Label } from "@/components/atoms/ui/label";
import { Checkbox } from "@/components/atoms/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/ui/select";
import { FileDropzone } from "@/components/molecules/file-dropzone";
import { LoadingProgress } from "@/components/molecules/loading-progress";
import { WizardShell, type WizardStep } from "@/components/organisms/wizard-shell";
import { ConversionReview } from "@/components/organisms/conversion-review";
import { RuleEditor } from "./rule-editor";
import { parseWorkbook, reanalyzeSheet, sheetToSourceRows, ParseError, type ParsedColumn } from "@/lib/engine/fileParser";
import { DEFAULT_NORMALIZATION } from "@/lib/engine/types";
import type {
  ColumnMapping,
  ConversionRule,
  SavedConversionTemplate,
  SourceRow,
  TargetColumnConfiguration,
} from "@/lib/engine/types";
import { createTemplate, updateTemplate } from "@/lib/actions/templates";
import type { TemplatePayload } from "@/lib/templates";
import { useBuilderStore, emptyDraft, draftFromTemplate, type Draft } from "./use-builder-store";

const STEPS: WizardStep[] = [
  { id: "target", title: "Upload target file", description: "The file format you need to create" },
  { id: "confirm", title: "Confirm target format", description: "Columns & formats" },
  { id: "source", title: "Upload source file", description: "A sample of your data" },
  { id: "match", title: "Map columns", description: "Where each column's value comes from" },
  { id: "rules", title: "Create rules", description: "How attendance is decided" },
  { id: "duplicates", title: "Set duplicate rules", description: "What must not repeat", optional: true },
  { id: "review", title: "Test & review", description: "Check the results" },
  { id: "save", title: "Save template", description: "Name it and publish" },
];

// Best-effort guess of whether a target column receives the computed Check-In or
// Check-Out time — used ONLY as an editable default in the Map-columns step, so
// the admin rarely has to change it. Everything else is inferred from the
// per-column mapping the admin confirms there (no separate "assign roles" step).
function guessComputedKind(header: string): "in_time" | "out_time" | null {
  const h = header.toLowerCase().replace(/[_\-.]+/g, " ");
  if (!/(time|punch|clock|swipe|check|\bin\b|\bout\b)/.test(h)) return null;
  if (/\bout\b|check ?out|punch ?out|time ?out|out ?time/.test(h)) return "out_time";
  if (/\bin\b|check ?in|punch ?in|time ?in|in ?time/.test(h)) return "in_time";
  return null;
}

// Encode/decode a column mapping as a <Select> value.
function mappingToValue(m: ColumnMapping): string {
  if (m.kind === "direct") return `src:${m.sourceColumn}`;
  if (m.kind === "in_time" || m.kind === "out_time" || m.kind === "blank" || m.kind === "unmapped") {
    return m.kind;
  }
  return "advanced"; // fixed / combined / formula / next_calendar_day_column — preserved as-is
}
function valueToMapping(v: string, prev: ColumnMapping): ColumnMapping {
  if (v.startsWith("src:")) return { kind: "direct", sourceColumn: v.slice(4) };
  if (v === "in_time" || v === "out_time" || v === "blank" || v === "unmapped") return { kind: v };
  return prev;
}

function parsedToTargetColumn(pc: ParsedColumn): TargetColumnConfiguration {
  const guess = pc.isBlankColumn ? null : guessComputedKind(pc.header);
  return {
    key: `c${pc.order}`,
    header: pc.header,
    displayName: pc.displayName,
    order: pc.order,
    required: pc.required,
    detectedType: pc.detectedType,
    sample: pc.sample != null ? String(pc.sample) : undefined,
    role: null,
    mapping: pc.isBlankColumn ? { kind: "blank" } : guess ? { kind: guess } : { kind: "unmapped" },
    format: pc.format,
  };
}

export function TemplateBuilder({
  companies,
  initial,
}: {
  companies: { id: string; name: string }[];
  initial?: SavedConversionTemplate;
}) {
  const router = useRouter();
  const contextId = initial?.id ?? "new";

  // Draft + step live in a persisted Zustand store, so a reload restores exactly
  // where you were with your data intact.
  const draft = useBuilderStore((s) => s.draft);
  const current = useBuilderStore((s) => s.current);
  const hasHydrated = useBuilderStore((s) => s.hasHydrated);
  const setCurrent = useBuilderStore((s) => s.setCurrent);
  const reset = useBuilderStore((s) => s.reset);
  const set = useBuilderStore((s) => s.patch);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Keep the parsed workbooks so worksheet/header changes can re-derive columns.
  const [parsedTarget, setParsedTarget] = useState<Awaited<ReturnType<typeof parseWorkbook>> | null>(null);

  // Restore persisted progress once per page-load, then make sure the restored
  // draft belongs to THIS template (new vs. a specific id) — else start fresh.
  useEffect(() => {
    if (!useBuilderStore.getState().hasHydrated) {
      useBuilderStore.persist.rehydrate();
      useBuilderStore.getState().setHasHydrated(true);
    }
    if (useBuilderStore.getState().contextId !== contextId) {
      reset(contextId, initial ? draftFromTemplate(initial) : emptyDraft(companies[0]?.id ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function assignTargetFromSheet(parsed: NonNullable<typeof parsedTarget>, worksheet: string, headerRow?: number) {
    const base = parsed.sheets[worksheet];
    if (!base) return;
    const sheet = headerRow ? reanalyzeSheet(base, headerRow) : base;
    set({
      targetWorksheet: worksheet,
      targetHeaderRow: sheet.detectedHeaderRow,
      targetColumns: sheet.columns.map(parsedToTargetColumn),
      targetStaticRows: sheet.staticRowsAboveHeader,
    });
  }

  async function onTargetFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const parsed = await parseWorkbook(await file.arrayBuffer(), file.name);
      setParsedTarget(parsed);
      set({
        targetFileName: parsed.fileName,
        targetFileType: parsed.fileType,
        targetSnapshot: parsed.workbookSnapshot,
        targetWorksheetNames: parsed.worksheetNames,
        name: draft.name || parsed.fileName.replace(/\.[^.]+$/, ""),
      });
      assignTargetFromSheet(parsed, parsed.suggestedWorksheet);
    } catch (e) {
      setError(e instanceof ParseError ? e.message : "We couldn't read that file. Try re-saving it as .xlsx.");
    } finally {
      setBusy(false);
    }
  }

  async function onSourceFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const parsed = await parseWorkbook(await file.arrayBuffer(), file.name);
      const sheet = parsed.sheets[parsed.suggestedWorksheet]!;
      set({
        sourceFileName: parsed.fileName,
        sourceWorksheet: parsed.suggestedWorksheet,
        sourceHeaderRow: sheet.detectedHeaderRow,
        sourceColumns: sheet.columns.map((c) => c.header),
        sourceSampleRows: sheetToSourceRows(sheet),
      });
    } catch (e) {
      setError(e instanceof ParseError ? e.message : "We couldn't read that file. Try re-saving it as .xlsx.");
    } finally {
      setBusy(false);
    }
  }

  const payload = useMemo((): TemplatePayload => {
    // Mappings are taken straight from what the admin set in the Map-columns
    // step — no role→mapping translation. One refinement: the column that copies
    // the source date column is a real DATE, so mark it as such — the output is
    // then formatted with the target date format (e.g. "2026-07-14") instead of
    // copied verbatim with any trailing text like a weekday ("2026-07-14 Tuesday").
    const columns = draft.targetColumns.map((col) =>
      col.mapping.kind === "direct" &&
      col.mapping.sourceColumn === draft.dateColumn &&
      col.detectedType !== "date"
        ? { ...col, detectedType: "date" as const }
        : col,
    );
    return {
      companyId: draft.companyId,
      name: draft.name,
      description: draft.description || undefined,
      status: draft.status,
      targetConfiguration: {
        originalFileName: draft.targetFileName,
        originalFileType: draft.targetFileType,
        workbookSnapshot: draft.targetSnapshot,
        worksheetNames: draft.targetWorksheetNames,
        outputWorksheetName: draft.targetWorksheet,
        outputWorksheetIndex: Math.max(0, draft.targetWorksheetNames.indexOf(draft.targetWorksheet)),
        headerRowNumber: draft.targetHeaderRow,
        staticRowsAboveHeader: draft.targetStaticRows as never,
        columns,
      },
      sourceConfiguration: {
        expectedWorksheetName: draft.sourceWorksheet || undefined,
        expectedHeaderRow: draft.sourceHeaderRow,
        expectedColumns: draft.sourceColumns,
        employeeColumn: draft.employeeColumn,
        dateColumn: draft.dateColumn,
        conditionColumn: draft.conditionColumn || undefined,
        sourceDateFormat: draft.sourceDateFormat || undefined,
        normalization: { ...DEFAULT_NORMALIZATION },
      },
      rules: draft.rules,
      defaultRule: draft.defaultRule,
      uniqueTargetFields: draft.uniqueTargetFields,
      outputConfiguration: { defaultExportMode: "valid_only" },
    };
  }, [draft]);

  const previewTemplate = useMemo(
    (): SavedConversionTemplate => ({
      id: initial?.id ?? "preview",
      createdAt: initial?.createdAt ?? "",
      updatedAt: "",
      version: initial?.version ?? 1,
      ...payload,
    }),
    [payload, initial],
  );

  const canAdvance = (): boolean => {
    switch (current) {
      case 0: return draft.targetColumns.length > 0 && !!draft.companyId;
      case 1: return draft.targetColumns.length > 0;
      case 2: return draft.sourceColumns.length > 0;
      // Map-columns: need the index keys AND a column each for the computed
      // Check-In and Check-Out, or the engine has nowhere to write the times.
      case 3:
        return (
          !!draft.employeeColumn &&
          !!draft.dateColumn &&
          draft.targetColumns.some((c) => c.mapping.kind === "in_time") &&
          draft.targetColumns.some((c) => c.mapping.kind === "out_time")
        );
      case 4: return draft.rules.length > 0;
      default: return true;
    }
  };

  async function save(status: SavedConversionTemplate["status"]) {
    setBusy(true);
    setError("");
    try {
      const finalPayload = { ...payload, status };
      if (initial) {
        await updateTemplate(initial.id, finalPayload, { bumpVersion: status === "active" });
      } else {
        await createTemplate(finalPayload);
      }
      // Saved — drop the persisted draft so a new build starts clean.
      useBuilderStore.persist.clearStorage();
      reset("", emptyDraft(companies[0]?.id ?? ""));
      router.push("/admin/templates");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while saving.");
      setBusy(false);
    }
  }

  const newRule = (): ConversionRule => ({
    id: crypto.randomUUID(),
    name: `Rule ${draft.rules.length + 1}`,
    conditions: draft.conditionColumn
      ? [{ sourceColumn: draft.conditionColumn, operator: "equals", values: [] }]
      : [],
    conditionJoin: "and",
    inTimeSource: { type: "current_row_column", column: draft.sourceColumns[0] ?? "" },
    outTimeSource: { type: "current_row_column", column: draft.sourceColumns[0] ?? "" },
    missingInTimeBehavior: "blank_both_review",
    missingOutTimeBehavior: "keep_in_blank_out_review",
    stopAfterMatch: true,
    order: draft.rules.length,
    active: true,
  });

  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <LoadingProgress messages={["Restoring your progress…"]} />
      </div>
    );
  }

  return (
    <WizardShell
      steps={STEPS}
      current={current}
      title={STEPS[current]!.title}
      onNavigate={(i) => i < current && setCurrent(i)}
      footer={
        <>
          <Button variant="ghost" onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0 || busy}>
            Back
          </Button>
          {current < STEPS.length - 1 ? (
            <Button onClick={() => setCurrent(current + 1)} disabled={!canAdvance() || busy}>
              Continue
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save("draft")} disabled={busy || !draft.name}>
                Save as draft
              </Button>
              <Button onClick={() => save("active")} disabled={busy || !draft.name}>
                Publish template
              </Button>
            </div>
          )}
        </>
      }
    >
      {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {busy && current < 3 ? (
        <LoadingProgress messages={["Reading your file…", "Finding worksheets…", "Detecting columns…"]} />
      ) : (
        <>
          {current === 0 && <StepTarget draft={draft} companies={companies} parsed={parsedTarget} set={set} onFile={onTargetFile} onWorksheet={(w) => parsedTarget && assignTargetFromSheet(parsedTarget, w)} onHeader={(h) => parsedTarget && assignTargetFromSheet(parsedTarget, draft.targetWorksheet, h)} />}
          {current === 1 && <StepConfirm draft={draft} set={set} />}
          {current === 2 && <StepSource draft={draft} onFile={onSourceFile} />}
          {current === 3 && <StepMatch draft={draft} set={set} />}
          {current === 4 && <StepRules draft={draft} set={set} newRule={newRule} />}
          {current === 5 && <StepDuplicates draft={draft} set={set} />}
          {current === 6 && <StepReview template={previewTemplate} rows={draft.sourceSampleRows} />}
          {current === 7 && <StepSave draft={draft} set={set} />}
        </>
      )}
    </WizardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

function StepTarget({
  draft,
  companies,
  parsed,
  set,
  onFile,
  onWorksheet,
  onHeader,
}: {
  draft: Draft;
  companies: { id: string; name: string }[];
  parsed: Awaited<ReturnType<typeof parseWorkbook>> | null;
  set: (p: Partial<Draft>) => void;
  onFile: (f: File) => void;
  onWorksheet: (w: string) => void;
  onHeader: (h: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="max-w-sm space-y-1.5">
        <Label>Which company is this for?</Label>
        <Select value={draft.companyId} onValueChange={(v) => set({ companyId: v })}>
          <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
          <SelectContent>
            {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">Upload the file format you need to create.</p>
        <FileDropzone onFile={onFile} fileName={draft.targetFileName || null} />
      </div>

      {parsed && draft.targetColumns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">We found your target format</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Worksheet</Label>
                <Select value={draft.targetWorksheet} onValueChange={onWorksheet}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {draft.targetWorksheetNames.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Header row</Label>
                <Input type="number" min={1} value={draft.targetHeaderRow} onChange={(e) => onHeader(Number(e.target.value) || 1)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Detected {draft.targetColumns.length} columns: {draft.targetColumns.map((c) => c.displayName).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepConfirm({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const dateFmt = draft.targetColumns.find((c) => c.format?.dateFormat)?.format?.dateFormat ?? "DD/MM/YYYY";
  const timeFmt = draft.targetColumns.find((c) => c.format?.timeFormat)?.format?.timeFormat ?? "h:mm AM/PM";
  // One global date/time format, written to every non-blank column. Each column
  // applies only the part matching its own detected type when writing cells, so
  // the field stays editable even when nothing was auto-detected as a date/time.
  const setFormat = (patch: { dateFormat?: string; timeFormat?: string }) =>
    set({
      targetColumns: draft.targetColumns.map((c) =>
        c.mapping.kind === "blank" ? c : { ...c, format: { ...c.format, ...patch } },
      ),
    });
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Confirm the columns we detected in your target file. You&apos;ll say where each column&apos;s value
        comes from in the “Map columns” step.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Target columns</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Column</th><th className="px-3 py-2">Required</th>
                  <th className="px-3 py-2">Type</th><th className="px-3 py-2">Example</th>
                </tr>
              </thead>
              <tbody>
                {draft.targetColumns.map((c) => (
                  <tr key={c.key} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{c.header}</td>
                    <td className="px-3 py-2">{c.required ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{c.detectedType}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.sample ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Target date format</Label>
          <Input value={dateFmt} onChange={(e) => setFormat({ dateFormat: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Target time format</Label>
          <Input value={timeFmt} onChange={(e) => setFormat({ timeFormat: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function StepSource({ draft, onFile }: { draft: Draft; onFile: (f: File) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload a sample of the file that contains the data you want to convert. It stays in your browser.
      </p>
      <FileDropzone onFile={onFile} fileName={draft.sourceFileName || null} />
      {draft.sourceColumns.length > 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Found {draft.sourceColumns.length} columns and {draft.sourceSampleRows.length} rows:{" "}
            <span className="text-foreground">{draft.sourceColumns.join(", ")}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ColumnPicker({ label, value, columns, onChange, sampleRow }: { label: string; value: string; columns: string[]; onChange: (v: string) => void; sampleRow?: SourceRow }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select a column" /></SelectTrigger>
        <SelectContent>
          {columns.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
              {sampleRow && sampleRow[c] != null ? `  ·  e.g. ${String(sampleRow[c])}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StepMatch({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const sample = draft.sourceSampleRows[0];
  const columns = draft.targetColumns.filter((c) => c.mapping.kind !== "blank");
  const hasIn = draft.targetColumns.some((c) => c.mapping.kind === "in_time");
  const hasOut = draft.targetColumns.some((c) => c.mapping.kind === "out_time");

  function setMapping(key: string, value: string) {
    set({
      targetColumns: draft.targetColumns.map((c) =>
        c.key === key ? { ...c, mapping: valueToMapping(value, c.mapping) } : c,
      ),
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Map every column in your target file to where its value comes from. Your source file stays in your
        browser.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Key source columns</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColumnPicker label="Which source column is the Employee ID?" value={draft.employeeColumn} columns={draft.sourceColumns} onChange={(v) => set({ employeeColumn: v })} sampleRow={sample} />
          <ColumnPicker label="Which source column is the attendance date?" value={draft.dateColumn} columns={draft.sourceColumns} onChange={(v) => set({ dateColumn: v })} sampleRow={sample} />
          <ColumnPicker label="Attendance note / condition (optional)" value={draft.conditionColumn} columns={draft.sourceColumns} onChange={(v) => set({ conditionColumn: v })} sampleRow={sample} />
          <div className="space-y-1.5">
            <Label>How are dates written in the source?</Label>
            <Input value={draft.sourceDateFormat} onChange={(e) => set({ sourceDateFormat: e.target.value })} placeholder="DD/MM/YYYY" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Fill each target column</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {(!hasIn || !hasOut) && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
              <p className="font-medium text-warning-foreground">
                Set your Check-In and Check-Out columns to continue
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Mark one column as <b>Check-In time (filled by rules)</b> and one as{" "}
                <b>Check-Out time (filled by rules)</b>. Those values are decided by your rules in the next
                step — that&apos;s where you point them at your OnDuty / OffDuty columns. Mapping them straight
                to a source column copies it as-is and skips your rules.
              </p>
            </div>
          )}
          {columns.map((c) => (
            <div key={c.key} className="grid items-center gap-3 sm:grid-cols-[1fr_1.4fr]">
              <div className="text-sm">
                <span className="font-medium">{c.header}</span>
                {c.required && <span className="ml-0.5 text-destructive">*</span>}
              </div>
              <Select value={mappingToValue(c.mapping)} onValueChange={(v) => setMapping(c.key, v)}>
                <SelectTrigger><SelectValue placeholder="Choose a source…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unmapped">— Not set —</SelectItem>
                  <SelectItem value="in_time">Check-In time (filled by rules)</SelectItem>
                  <SelectItem value="out_time">Check-Out time (filled by rules)</SelectItem>
                  <SelectItem value="blank">Leave blank</SelectItem>
                  {mappingToValue(c.mapping) === "advanced" && (
                    <SelectItem value="advanced">Advanced mapping (kept)</SelectItem>
                  )}
                  {draft.sourceColumns.map((sc) => (
                    <SelectItem key={sc} value={`src:${sc}`}>From “{sc}”</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {columns.length === 0 && (
            <p className="text-sm text-muted-foreground">No columns to map.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepRules({ draft, set, newRule }: { draft: Draft; set: (p: Partial<Draft>) => void; newRule: () => ConversionRule }) {
  function updateRule(i: number, rule: ConversionRule) {
    set({ rules: draft.rules.map((r, ri) => (ri === i ? rule : r)) });
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...draft.rules];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ rules: next.map((r, idx) => ({ ...r, order: idx })) });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Rules are checked top to bottom. The first matching rule decides the Check-In and Check-Out times.
      </p>
      {draft.rules.map((rule, i) => (
        <RuleEditor
          key={rule.id}
          rule={rule}
          index={i}
          total={draft.rules.length}
          sourceColumns={draft.sourceColumns}
          employeeColumn={draft.employeeColumn}
          dateColumn={draft.dateColumn}
          onChange={(r) => updateRule(i, r)}
          onRemove={() => set({ rules: draft.rules.filter((_, ri) => ri !== i).map((r, idx) => ({ ...r, order: idx })) })}
          onMove={(dir) => move(i, dir)}
        />
      ))}
      <Button variant="outline" onClick={() => set({ rules: [...draft.rules, newRule()] })}>
        <Plus className="h-4 w-4" /> Add a rule
      </Button>
    </div>
  );
}

function StepDuplicates({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  function toggle(key: string) {
    const has = draft.uniqueTargetFields.includes(key);
    set({ uniqueTargetFields: has ? draft.uniqueTargetFields.filter((k) => k !== key) : [...draft.uniqueTargetFields, key] });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Which target information must not repeat? A record is a duplicate when all ticked values match.</p>
      <div className="space-y-2">
        {draft.targetColumns.filter((c) => c.mapping.kind !== "blank").map((c) => (
          <label key={c.key} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <Checkbox checked={draft.uniqueTargetFields.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
            {c.displayName}
          </label>
        ))}
      </div>
    </div>
  );
}

function StepReview({ template, rows }: { template: SavedConversionTemplate; rows: SourceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Upload a source file (step 3) to test your rules against real rows.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Here&apos;s how your rules handle the uploaded sample. Fix anything that looks off before publishing.</p>
      <ConversionReview template={template} sourceRows={rows} />
    </div>
  );
}

function StepSave({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Label>Template name</Label>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Monthly Attendance Import" />
      </div>
      <div className="space-y-1.5">
        <Label>Description (optional)</Label>
        <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What this template is for…" />
      </div>
      <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm">
        <p className="font-medium">Ready to save</p>
        <p className="text-muted-foreground">
          Output: {draft.targetFileName || "—"} · {draft.targetColumns.length} columns · {draft.rules.length} rules ·{" "}
          {draft.uniqueTargetFields.length} duplicate field(s)
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Save as draft to keep working, or publish to make it available to HR users for this company.
      </p>
    </div>
  );
}
