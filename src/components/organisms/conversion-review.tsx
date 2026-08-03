"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, FileWarning, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { Checkbox } from "@/components/atoms/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/ui/dialog";
import { SummaryCard } from "@/components/molecules/summary-card";
import { StatusBadge } from "@/components/molecules/status-badge";
import { EmptyState } from "@/components/molecules/empty-state";
import { runConfigurableAttendanceTransform, summarize } from "@/lib/engine/configurableAttendanceTransform";
import { generateTargetFile, rowsForOutput } from "@/lib/engine/targetFileGenerator";
import { formatCellForDisplay } from "@/lib/engine/format";
import { isBlank } from "@/lib/engine/normalize";
import { triggerDownload } from "@/lib/download";
import { cn } from "@/lib/utils";
import type {
  ConversionResult,
  ConvertedRow,
  OutputExportMode,
  RowStatus,
  SavedConversionTemplate,
  SourceRow,
} from "@/lib/engine/types";

type Filter = "all" | RowStatus;

const NUMERIC_PREFIX = "#";
const NO_ID_PREFIX = "(no ID)";

export function ConversionReview({
  template,
  sourceRows,
  fileNameOverride,
  uploadedList,
  onDownloaded,
}: {
  template: SavedConversionTemplate;
  sourceRows: SourceRow[];
  fileNameOverride?: string;
  uploadedList?: string[];
  onDownloaded?: (mode: OutputExportMode, summary: ConversionResult["summary"]) => void;
}) {
  const result = useMemo(
    () =>
      runConfigurableAttendanceTransform({
        sourceRows,
        targetConfiguration: template.targetConfiguration,
        sourceConfiguration: template.sourceConfiguration,
        rules: template.rules,
        defaultRule: template.defaultRule ?? null,
        uniqueTargetFields: template.uniqueTargetFields,
        uploadedList,
      }),
    [template, sourceRows, uploadedList],
  );

  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [warnIncomplete, setWarnIncomplete] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const columns = useMemo(
    () => template.targetConfiguration.columns.slice().sort((a, b) => a.order - b.order),
    [template],
  );

  const empKey = useMemo(() => {
    const col = columns.find(
      (c) => c.mapping.kind === "direct" && c.mapping.sourceColumn === template.sourceConfiguration.employeeColumn,
    );
    return col?.key;
  }, [columns, template.sourceConfiguration.employeeColumn]);

  const prefixOf = useCallback(
    (row: ConvertedRow): string => {
      const v = empKey ? row.cells[empKey]?.value : null;
      const str = v == null ? "" : String(v).trim();
      const m = str.match(/^([A-Za-z]+)/);
      if (m) return m[1]!.toUpperCase();
      return str ? NUMERIC_PREFIX : NO_ID_PREFIX;
    },
    [empKey],
  );

  const writableRows = useMemo(
    () => rowsForOutput(result.rows, "include_incomplete", columns),
    [result.rows, columns],
  );
  const prefixCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of writableRows) {
      const p = prefixOf(r);
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [writableRows, prefixOf]);

  const showPrefixFilter = prefixCounts.length >= 2;
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedPrefixes(new Set(prefixCounts.map(([p]) => p)));
  }, [prefixCounts]);
  function togglePrefix(p: string, on: boolean) {
    setSelectedPrefixes((prev) => {
      const next = new Set(prev);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  const downloadRows = useMemo(
    () => (showPrefixFilter ? result.rows.filter((r) => selectedPrefixes.has(prefixOf(r))) : result.rows),
    [result.rows, showPrefixFilter, selectedPrefixes, prefixOf],
  );
  const readyCount = useMemo(() => rowsForOutput(downloadRows, "valid_only", columns).length, [downloadRows, columns]);
  const exportRows = useMemo(
    () => rowsForOutput(downloadRows, "include_incomplete", columns),
    [downloadRows, columns],
  );
  const includeCount = exportRows.length;

  // Records that will be written with a Check-In or Check-Out still empty —
  // they must be completed before the file is uploaded to the HR system.
  const incomplete = useMemo(() => {
    const inKey = columns.find((c) => c.mapping.kind === "in_time" || c.role === "in_time")?.key;
    const outKey = columns.find((c) => c.mapping.kind === "out_time" || c.role === "out_time")?.key;
    if (!inKey || !outKey) return { rows: 0, missingIn: 0, missingOut: 0 };
    let rows = 0;
    let missingIn = 0;
    let missingOut = 0;
    for (const r of exportRows) {
      const noIn = isBlank(r.cells[inKey]?.value ?? null);
      const noOut = isBlank(r.cells[outKey]?.value ?? null);
      if (noIn) missingIn++;
      if (noOut) missingOut++;
      if (noIn || noOut) rows++;
    }
    return { rows, missingIn, missingOut };
  }, [exportRows, columns]);

  const visibleRows = useMemo(() => {
    if (filter === "all") return downloadRows;
    return downloadRows.filter((r) => r.status === filter || r.warnings.includes(filter));
  }, [downloadRows, filter]);

  useEffect(() => setPage(1), [filter, pageSize, visibleRows.length]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleRows, safePage, pageSize],
  );
  const rangeStart = visibleRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, visibleRows.length);

  const s = useMemo(() => summarize(downloadRows), [downloadRows]);

  async function download(mode: OutputExportMode) {
    setBusy(true);
    try {
      const file = await generateTargetFile({
        targetConfiguration: template.targetConfiguration,
        convertedRows: downloadRows,
        outputMode: mode,
        fileNameOverride,
      });
      triggerDownload(file);
      onDownloaded?.(mode, summarize(rowsForOutput(downloadRows, mode, columns)));
    } finally {
      setBusy(false);
    }
  }

  const tc = template.targetConfiguration;
  const outName = fileNameOverride || tc.originalFileName;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Ready" value={s.ready} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} active={filter === "ready"} onClick={() => setFilter(filter === "ready" ? "all" : "ready")} />
        <SummaryCard label="Missing Check-In" value={s.missingInTime} tone="destructive" icon={<FileWarning className="h-5 w-5" />} active={filter === "missing_in_time"} onClick={() => setFilter(filter === "missing_in_time" ? "all" : "missing_in_time")} />
        <SummaryCard label="Missing Check-Out" value={s.missingOutTime} tone="warning" icon={<Clock className="h-5 w-5" />} active={filter === "missing_out_time"} onClick={() => setFilter(filter === "missing_out_time" ? "all" : "missing_out_time")} />
        <SummaryCard label="Next-Day Missing" value={s.nextDayRecordMissing} tone="warning" icon={<Clock className="h-5 w-5" />} active={filter === "next_day_record_missing"} onClick={() => setFilter(filter === "next_day_record_missing" ? "all" : "next_day_record_missing")} />
        <SummaryCard label="No / Multiple Rule" value={s.noMatchingRule + s.multipleRulesMatched} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} active={filter === "no_matching_rule"} onClick={() => setFilter(filter === "no_matching_rule" ? "all" : "no_matching_rule")} />
        <SummaryCard label="Duplicates" value={s.duplicate} tone="destructive" icon={<Layers className="h-5 w-5" />} active={filter === "duplicate"} onClick={() => setFilter(filter === "duplicate" ? "all" : "duplicate")} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            {filter === "all" ? "All records" : "Filtered records"}{" "}
            <span className="font-normal text-muted-foreground">({visibleRows.length})</span>
          </CardTitle>
          {filter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
              Clear filter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {visibleRows.length === 0 ? (
            <EmptyState title="Nothing here" description="No records match this filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {columns.map((c) => (
                      <th key={c.key} className="px-3 py-2 font-medium">
                        {c.displayName}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Applied rule</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.sourceRowIndex} className="border-b border-border/60 last:border-0">
                      {columns.map((c) => {
                        const cell = row.cells[c.key];
                        return (
                          <td key={c.key} className="px-3 py-2" title={cell?.provenance.description}>
                            {formatCellForDisplay(cell?.value ?? null, c) || (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-muted-foreground">{row.appliedRuleName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  Rows per page
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
                  >
                    {[25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {rangeStart}–{rangeEnd} of {visibleRows.length}
                  </span>
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span className="tabular-nums text-muted-foreground">
                    {safePage} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showPrefixFilter && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              Employee ID groups{" "}
              <span className="font-normal text-muted-foreground">({selectedPrefixes.size} of {prefixCounts.length})</span>
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPrefixes(new Set(prefixCounts.map(([p]) => p)))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPrefixes(new Set())}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Only the ticked ID groups are written to the downloaded file.
            </p>
            <div className="flex flex-wrap gap-2">
              {prefixCounts.map(([p, count]) => {
                const on = selectedPrefixes.has(p);
                return (
                  <label
                    key={p}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <Checkbox checked={on} onCheckedChange={(c) => togglePrefix(p, c === true)} />
                    <span className="font-medium">
                      {p === NO_ID_PREFIX ? (
                        "No ID"
                      ) : (
                        <>
                          {p === NUMERIC_PREFIX ? "0–9" : p}
                          <span className="text-muted-foreground">*</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Download</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-muted-foreground">File name</dt>
              <dd className="truncate font-medium" title={outName}>{outName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Format</dt>
              <dd className="font-medium uppercase">{tc.originalFileType}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Worksheet</dt>
              <dd className="truncate font-medium" title={tc.outputWorksheetName}>{tc.outputWorksheetName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Records to export</dt>
              <dd className="font-medium">{includeCount} of {s.total}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() =>
                incomplete.rows > 0 ? setWarnIncomplete(true) : void download("include_incomplete")
              }
              disabled={busy || includeCount === 0}
              loading={busy}
            >
              <Download className="h-4 w-4" /> Download template ({includeCount})
            </Button>
          </div>
          {incomplete.rows > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
              <div className="text-sm">
                <p className="font-medium">
                  {incomplete.rows} of {includeCount} records are incomplete.
                </p>
                <p className="text-muted-foreground">
                  {incomplete.missingIn > 0 && <>{incomplete.missingIn} missing a Check-In</>}
                  {incomplete.missingIn > 0 && incomplete.missingOut > 0 && " · "}
                  {incomplete.missingOut > 0 && <>{incomplete.missingOut} missing a Check-Out</>}
                  . Fill these in before you upload the file to your HR system.
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            The downloaded file uses your saved target format, worksheet, column order and filename.
            Every record with a Check-In or a Check-Out is included ({readyCount} ready and{" "}
            {includeCount - readyCount} incomplete); rows with no Check-In and no Check-Out are skipped.
            {showPrefixFilter ? " Only selected ID groups are included." : ""}
          </p>
        </CardContent>
      </Card>

      <Dialog open={warnIncomplete} onOpenChange={(o) => !o && !busy && setWarnIncomplete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-foreground" />
              Some records are incomplete
            </DialogTitle>
            <DialogDescription>
              {incomplete.rows} of the {includeCount} records in this file still need a punch time.
              Please complete them before uploading the file to your HR system.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-muted-foreground">Missing Check-In</dt>
              <dd className="text-lg font-semibold">{incomplete.missingIn}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-muted-foreground">Missing Check-Out</dt>
              <dd className="text-lg font-semibold">{incomplete.missingOut}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Tip: the summary cards above filter the table to exactly these records, so you can see who
            they are before you download.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setWarnIncomplete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await download("include_incomplete");
                setWarnIncomplete(false);
              }}
              loading={busy}
            >
              <Download className="h-4 w-4" /> Download anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
