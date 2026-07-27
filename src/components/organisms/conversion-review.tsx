"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, FileWarning, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { Checkbox } from "@/components/atoms/ui/checkbox";
import { SummaryCard } from "@/components/molecules/summary-card";
import { StatusBadge } from "@/components/molecules/status-badge";
import { EmptyState } from "@/components/molecules/empty-state";
import { runConfigurableAttendanceTransform } from "@/lib/engine/configurableAttendanceTransform";
import { generateTargetFile, rowsForOutput } from "@/lib/engine/targetFileGenerator";
import { formatCellForDisplay } from "@/lib/engine/format";
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

export function ConversionReview({
  template,
  sourceRows,
  fileNameOverride,
  onDownloaded,
}: {
  template: SavedConversionTemplate;
  sourceRows: SourceRow[];
  fileNameOverride?: string;
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
      }),
    [template, sourceRows],
  );

  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [dlMode, setDlMode] = useState<OutputExportMode | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const columns = useMemo(
    () => template.targetConfiguration.columns.slice().sort((a, b) => a.order - b.order),
    [template],
  );

  // --- Employee-ID prefix filter --------------------------------------------
  // The output column that carries the Employee ID (direct copy of the source
  // employee column). Its value's leading letters are the "prefix".
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
      return str ? "#" : ""; // "#" = numeric/other id; "" = no id
    },
    [empKey],
  );

  const prefixCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of result.rows) {
      const p = prefixOf(r);
      if (p === "") continue;
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [result.rows, prefixOf]);

  const showPrefixFilter = prefixCounts.length >= 2;
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());
  // Default: all prefixes selected; reset whenever the set of prefixes changes.
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

  // Rows eligible for download: only the selected ID prefixes.
  const downloadRows = useMemo(
    () => (showPrefixFilter ? result.rows.filter((r) => selectedPrefixes.has(prefixOf(r))) : result.rows),
    [result.rows, showPrefixFilter, selectedPrefixes, prefixOf],
  );
  const readyCount = useMemo(() => rowsForOutput(downloadRows, "valid_only", columns).length, [downloadRows, columns]);
  const includeCount = useMemo(
    () => rowsForOutput(downloadRows, "include_incomplete", columns).length,
    [downloadRows, columns],
  );

  const visibleRows = useMemo(() => {
    if (filter === "all") return result.rows;
    return result.rows.filter((r) => r.status === filter || r.warnings.includes(filter));
  }, [result.rows, filter]);

  // Pagination — back to page 1 whenever the filter, page size, or data changes.
  useEffect(() => setPage(1), [filter, pageSize, visibleRows.length]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleRows, safePage, pageSize],
  );
  const rangeStart = visibleRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, visibleRows.length);

  const s = result.summary;

  async function download(mode: OutputExportMode) {
    setBusy(true);
    setDlMode(mode);
    try {
      const file = await generateTargetFile({
        targetConfiguration: template.targetConfiguration,
        convertedRows: downloadRows,
        outputMode: mode,
        fileNameOverride,
      });
      triggerDownload(file);
      onDownloaded?.(mode, result.summary);
    } finally {
      setBusy(false);
      setDlMode(null);
    }
  }

  const tc = template.targetConfiguration;
  const outName = fileNameOverride || tc.originalFileName;

  return (
    <div className="space-y-6">
      {/* Summary cards (clickable filters) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Ready" value={s.ready} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} active={filter === "ready"} onClick={() => setFilter(filter === "ready" ? "all" : "ready")} />
        <SummaryCard label="Missing Check-In" value={s.missingInTime} tone="destructive" icon={<FileWarning className="h-5 w-5" />} active={filter === "missing_in_time"} onClick={() => setFilter(filter === "missing_in_time" ? "all" : "missing_in_time")} />
        <SummaryCard label="Missing Check-Out" value={s.missingOutTime} tone="warning" icon={<Clock className="h-5 w-5" />} active={filter === "missing_out_time"} onClick={() => setFilter(filter === "missing_out_time" ? "all" : "missing_out_time")} />
        <SummaryCard label="Next-Day Missing" value={s.nextDayRecordMissing} tone="warning" icon={<Clock className="h-5 w-5" />} active={filter === "next_day_record_missing"} onClick={() => setFilter(filter === "next_day_record_missing" ? "all" : "next_day_record_missing")} />
        <SummaryCard label="No / Multiple Rule" value={s.noMatchingRule + s.multipleRulesMatched} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} active={filter === "no_matching_rule"} onClick={() => setFilter(filter === "no_matching_rule" ? "all" : "no_matching_rule")} />
        <SummaryCard label="Duplicates" value={s.duplicate} tone="destructive" icon={<Layers className="h-5 w-5" />} active={filter === "duplicate"} onClick={() => setFilter(filter === "duplicate" ? "all" : "duplicate")} />
      </div>

      {/* Results table */}
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

      {/* Employee-ID prefix filter */}
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
                      {p === "#" ? "0–9" : p}
                      <span className="text-muted-foreground">*</span>
                    </span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download panel */}
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
              <dt className="text-muted-foreground">Ready records</dt>
              <dd className="font-medium">{readyCount} of {s.total}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => download("valid_only")}
              disabled={busy || readyCount === 0}
              loading={dlMode === "valid_only"}
            >
              {dlMode !== "valid_only" && <Download className="h-4 w-4" />} Download ready only ({readyCount})
            </Button>
            <Button
              variant="outline"
              onClick={() => download("include_incomplete")}
              disabled={busy || includeCount === 0}
              loading={dlMode === "include_incomplete"}
            >
              Include incomplete ({includeCount})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The downloaded file uses your saved target format, worksheet, column order and filename.
            Rows with no Check-In and no Check-Out are skipped; a blank Check-In always produces a blank Check-Out.
            {showPrefixFilter ? " Only selected ID groups are included." : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
