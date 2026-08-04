"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, FileWarning, Layers, AlertTriangle, Search, X } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { Checkbox } from "@/components/atoms/ui/checkbox";
import { Input } from "@/components/atoms/ui/input";
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
import { isBlank, parseCalendarDate } from "@/lib/engine/normalize";
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
const NO_RULE = "No matching rule";
const NO_DATE = "(no date)";

export function ConversionReview({
  template,
  sourceRows,
  fileNameOverride,
  uploadedList,
  allowDownload = true,
  onDownloaded,
}: {
  template: SavedConversionTemplate;
  sourceRows: SourceRow[];
  fileNameOverride?: string;
  uploadedList?: string[];
  /** Producing the file is HR's step; the builder only previews the result. */
  allowDownload?: boolean;
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
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
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

  // --- Attendance date -------------------------------------------------------
  // A file often spans more than one day because an overnight shift needs the
  // next morning's punch to close it. Those extra days are lookup data, so the
  // date a record belongs to decides whether it is written to the file.
  const dateKeyCol = useMemo(() => {
    const byRole = columns.find((c) => c.role === "date");
    if (byRole) return byRole.key;
    return columns.find(
      (c) => c.mapping.kind === "direct" && c.mapping.sourceColumn === template.sourceConfiguration.dateColumn,
    )?.key;
  }, [columns, template.sourceConfiguration.dateColumn]);

  const dateOf = useCallback(
    (row: ConvertedRow): string => {
      const v = dateKeyCol ? (row.cells[dateKeyCol]?.value ?? null) : null;
      const d = parseCalendarDate(v);
      if (!d) return NO_DATE;
      return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    },
    [dateKeyCol],
  );

  const dateCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of writableRows) {
      const d = dateOf(r);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    // Chronological, with undated rows last.
    return [...m.entries()].sort((a, b) =>
      a[0] === NO_DATE ? 1 : b[0] === NO_DATE ? -1 : a[0].localeCompare(b[0]),
    );
  }, [writableRows, dateOf]);

  const showDateFilter = dateCounts.length >= 2;
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedDates(new Set(dateCounts.map(([d]) => d)));
  }, [dateCounts]);
  function toggleDate(d: string, on: boolean) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (on) next.add(d);
      else next.delete(d);
      return next;
    });
  }

  const downloadRows = useMemo(
    () =>
      result.rows.filter(
        (r) =>
          (!showPrefixFilter || selectedPrefixes.has(prefixOf(r))) &&
          (!showDateFilter || selectedDates.has(dateOf(r))),
      ),
    [result.rows, showPrefixFilter, selectedPrefixes, prefixOf, showDateFilter, selectedDates, dateOf],
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

  // Which rules actually fired, so the filter offers exactly the shifts this
  // template produced (Day shift, Overnight shift, …) rather than a fixed list.
  const ruleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of downloadRows) {
      const name = r.appliedRuleName ?? NO_RULE;
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [downloadRows]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return downloadRows.filter((r) => {
      if (filter !== "all" && !(r.status === filter || r.warnings.includes(filter))) return false;
      if (ruleFilter !== "all" && (r.appliedRuleName ?? NO_RULE) !== ruleFilter) return false;
      if (needle) {
        const id = empKey ? String(r.cells[empKey]?.value ?? "") : "";
        if (!id.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [downloadRows, filter, ruleFilter, search, empKey]);

  useEffect(() => setPage(1), [filter, ruleFilter, search, pageSize, visibleRows.length]);
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
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              {filter === "all" && ruleFilter === "all" && !search.trim() ? "All records" : "Filtered records"}{" "}
              <span className="font-normal text-muted-foreground">({visibleRows.length})</span>
            </CardTitle>
            {(filter !== "all" || ruleFilter !== "all" || search.trim() !== "") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setRuleFilter("all");
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search by employee ID */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-56 pl-8"
                placeholder="Search employee ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!empKey}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter by the rule that decided the row (Day shift, Overnight shift, …) */}
            {ruleCounts.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Shift rule</span>
                <Button
                  variant={ruleFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setRuleFilter("all")}
                >
                  All
                </Button>
                {ruleCounts.map(([name, count]) => (
                  <Button
                    key={name}
                    variant={ruleFilter === name ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setRuleFilter(ruleFilter === name ? "all" : name)}
                    title={name}
                  >
                    <span className="max-w-[190px] truncate">{name}</span>
                    <span className="text-muted-foreground">({count})</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visibleRows.length === 0 ? (
            <EmptyState
              title="Nothing here"
              description={
                search.trim()
                  ? `No records with an employee ID containing “${search.trim()}”.`
                  : "No records match this filter."
              }
            />
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

      {showDateFilter && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              Attendance dates{" "}
              <span className="font-normal text-muted-foreground">({selectedDates.size} of {dateCounts.length})</span>
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDates(new Set(dateCounts.map(([d]) => d)))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDates(new Set())}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This file covers more than one day. Only the ticked dates are written to the downloaded
              file — untick the extra day you uploaded just so overnight shifts could find the next
              morning&apos;s punch.
            </p>
            <div className="flex flex-wrap gap-2">
              {dateCounts.map(([d, count]) => {
                const on = selectedDates.has(d);
                return (
                  <label
                    key={d}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <Checkbox checked={on} onCheckedChange={(c) => toggleDate(d, c === true)} />
                    <span className="font-medium">{d === NO_DATE ? "No date" : d}</span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
          <CardTitle className="text-base">{allowDownload ? "Download" : "What HR will get"}</CardTitle>
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
          {allowDownload ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">
              This is a preview of the conversion. HR downloads the file from their own screen once
              this template is published.
            </p>
          )}
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
            {showDateFilter
              ? ` Only the ${selectedDates.size} selected attendance date${selectedDates.size === 1 ? "" : "s"} are included.`
              : ""}
            {showPrefixFilter ? " Only selected ID groups are included." : ""}
          </p>
        </CardContent>
      </Card>

      <Dialog open={allowDownload && warnIncomplete} onOpenChange={(o) => !o && !busy && setWarnIncomplete(false)}>
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
