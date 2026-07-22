"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, FileWarning, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { SummaryCard } from "@/components/molecules/summary-card";
import { StatusBadge } from "@/components/molecules/status-badge";
import { EmptyState } from "@/components/molecules/empty-state";
import { runConfigurableAttendanceTransform } from "@/lib/engine/configurableAttendanceTransform";
import { generateTargetFile } from "@/lib/engine/targetFileGenerator";
import { formatCellForDisplay } from "@/lib/engine/format";
import { triggerDownload } from "@/lib/download";
import type {
  ConversionResult,
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
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const columns = useMemo(
    () => template.targetConfiguration.columns.slice().sort((a, b) => a.order - b.order),
    [template],
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
    try {
      const file = await generateTargetFile({
        targetConfiguration: template.targetConfiguration,
        convertedRows: result.rows,
        outputMode: mode,
        fileNameOverride,
      });
      triggerDownload(file);
      onDownloaded?.(mode, result.summary);
    } finally {
      setBusy(false);
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
              <dd className="font-medium">{s.ready} of {s.total}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => download("valid_only")} disabled={busy}>
              <Download className="h-4 w-4" /> Download ready only ({s.ready})
            </Button>
            <Button variant="outline" onClick={() => download("include_incomplete")} disabled={busy}>
              Include incomplete ({s.total - s.excluded})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The downloaded file uses your saved target format, worksheet, column order and filename.
            A blank Check-In always produces a blank Check-Out.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
