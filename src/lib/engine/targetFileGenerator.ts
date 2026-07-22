/**
 * Target-format output generator (spec §31).
 *
 * The downloaded file is generated FROM the saved target workbook, not as a
 * generic new table. We reload the original workbook bytes and:
 *   - keep worksheet names & order, static rows above the header, the header
 *     row, column names & order, blank columns, widths, frozen panes;
 *   - write converted records only into the data area below the header;
 *   - format each value using the target's own date/time/number/text formats.
 *
 * Runs in the browser (ExcelJS) so source data never leaves the machine.
 */
import ExcelJS from "exceljs";
import type {
  CellValue,
  ConvertedRow,
  OutputExportMode,
  TargetColumnConfiguration,
  TargetWorkbookConfiguration,
} from "./types";
import { isBlank, parseCalendarDate } from "./normalize";
import {
  formatCellForDisplay,
  parseTime,
  timeToFraction,
  toExcelNumFmt,
} from "./format";

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

export type GenerateTargetFileInput = {
  targetConfiguration: TargetWorkbookConfiguration;
  convertedRows: ConvertedRow[];
  outputMode: OutputExportMode;
  /** Explicit filename (without needing the pattern). */
  fileNameOverride?: string;
};

export type GeneratedFile = {
  data: Uint8Array;
  fileName: string;
  fileType: "xlsx" | "csv";
  mimeType: string;
};

// ---------------------------------------------------------------------------
// Row filtering by export mode. The blank-In-forces-blank-Out invariant is
// already enforced in the converted cells, so no filtered row can leak an
// In=blank / Out=present record.
// ---------------------------------------------------------------------------

function filterRows(rows: ConvertedRow[], mode: OutputExportMode): ConvertedRow[] {
  const notExcluded = rows.filter((r) => !r.excluded);
  if (mode === "valid_only") return notExcluded.filter((r) => r.status === "ready");
  return notExcluded; // "all" and "include_incomplete"
}

// ---------------------------------------------------------------------------
// Value → typed Excel cell. Dates/times are written as numeric serials with a
// number format, which is timezone-safe and round-trips cleanly.
// ---------------------------------------------------------------------------

function dateToSerial(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - EXCEL_EPOCH_UTC) / 86_400_000);
}

function writeTypedCell(
  cell: ExcelJS.Cell,
  value: CellValue,
  col: TargetColumnConfiguration,
): void {
  if (col.mapping.kind === "blank" || isBlank(value)) {
    const placeholder = col.format?.blankPlaceholder;
    cell.value = placeholder ? placeholder : null;
    return;
  }

  const numFmt = toExcelNumFmt(col.detectedType, col.format);

  switch (col.detectedType) {
    case "date": {
      const d = parseCalendarDate(value);
      if (d) {
        cell.value = dateToSerial(d.year, d.month, d.day);
        if (numFmt) cell.numFmt = numFmt;
      } else {
        cell.value = String(value);
      }
      return;
    }
    case "time": {
      const t = parseTime(value);
      if (t) {
        cell.value = timeToFraction(t);
        if (numFmt) cell.numFmt = numFmt;
      } else {
        cell.value = String(value);
      }
      return;
    }
    case "datetime": {
      const d = parseCalendarDate(value);
      const t = parseTime(value);
      if (d) {
        cell.value = dateToSerial(d.year, d.month, d.day) + (t ? timeToFraction(t) : 0);
        if (numFmt) cell.numFmt = numFmt;
      } else {
        cell.value = String(value);
      }
      return;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value));
      cell.value = Number.isNaN(n) ? String(value) : n;
      if (numFmt) cell.numFmt = numFmt;
      return;
    }
    case "text":
    default: {
      // Preserve leading zeros etc. by forcing text.
      cell.value = typeof value === "number" ? value : String(value);
      if (col.format?.preserveLeadingZeros) {
        cell.value = String(value);
        cell.numFmt = "@";
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// base64 <-> bytes (works in browser and Node)
// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// ---------------------------------------------------------------------------
// XLSX generation
// ---------------------------------------------------------------------------

async function generateXlsx(input: GenerateTargetFileInput): Promise<Uint8Array> {
  const { targetConfiguration: tc, convertedRows, outputMode } = input;
  const workbook = new ExcelJS.Workbook();
  const orderedColumns = tc.columns.slice().sort((a, b) => a.order - b.order);

  let worksheet: ExcelJS.Worksheet;

  if (tc.workbookSnapshot) {
    // Reload the original workbook to preserve every safe detail.
    await workbook.xlsx.load(base64ToBytes(tc.workbookSnapshot) as unknown as ExcelJS.Buffer);
    worksheet =
      workbook.getWorksheet(tc.outputWorksheetName) ??
      workbook.worksheets[tc.outputWorksheetIndex] ??
      workbook.worksheets[0]!;
    // Remove any sample/data rows below the header so only real data remains.
    const firstDataRow = tc.headerRowNumber + 1;
    if (worksheet.rowCount >= firstDataRow) {
      worksheet.spliceRows(firstDataRow, worksheet.rowCount - tc.headerRowNumber);
    }
  } else {
    // No snapshot (e.g. built programmatically): reconstruct the shell.
    worksheet = workbook.addWorksheet(tc.outputWorksheetName || "Sheet1");
    tc.staticRowsAboveHeader.forEach((r, i) => {
      worksheet.getRow(i + 1).values = r as ExcelJS.CellValue[];
    });
    const headerRow = worksheet.getRow(tc.headerRowNumber);
    orderedColumns.forEach((col) => {
      headerRow.getCell(col.order + 1).value = col.header;
    });
    orderedColumns.forEach((col) => {
      if (col.width) worksheet.getColumn(col.order + 1).width = col.width;
    });
    if (tc.frozenPane) {
      worksheet.views = [
        {
          state: "frozen",
          xSplit: tc.frozenPane.frozenColumns ?? 0,
          ySplit: tc.frozenPane.frozenRows ?? tc.headerRowNumber,
        },
      ];
    }
  }

  // Write converted rows into the data area.
  const rowsToWrite = filterRows(convertedRows, outputMode);
  rowsToWrite.forEach((row, i) => {
    const excelRow = worksheet.getRow(tc.headerRowNumber + 1 + i);
    orderedColumns.forEach((col) => {
      const cell = excelRow.getCell(col.order + 1);
      const value = row.cells[col.key]?.value ?? null;
      writeTypedCell(cell, value, col);
    });
    excelRow.commit?.();
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// CSV generation (formatting is applied as text; styling cannot be preserved)
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function generateCsv(input: GenerateTargetFileInput): Uint8Array {
  const { targetConfiguration: tc, convertedRows, outputMode } = input;
  const orderedColumns = tc.columns.slice().sort((a, b) => a.order - b.order);
  const lines: string[] = [];

  tc.staticRowsAboveHeader.forEach((r) => {
    lines.push(r.map((c) => csvEscape(c == null ? "" : String(c))).join(","));
  });
  lines.push(orderedColumns.map((c) => csvEscape(c.header)).join(","));

  filterRows(convertedRows, outputMode).forEach((row) => {
    lines.push(
      orderedColumns
        .map((col) => csvEscape(formatCellForDisplay(row.cells[col.key]?.value ?? null, col)))
        .join(","),
    );
  });

  const text = "﻿" + lines.join("\r\n"); // BOM for Excel compatibility
  return new TextEncoder().encode(text);
}

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

function baseName(fileName: string): { name: string; ext: string } {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return { name: fileName, ext: "" };
  return { name: fileName.slice(0, dot), ext: fileName.slice(dot) };
}

function resolveFileName(input: GenerateTargetFileInput, actualType: "xlsx" | "csv"): string {
  if (input.fileNameOverride) return input.fileNameOverride;
  const { name } = baseName(input.targetConfiguration.originalFileName || "converted");
  return `${name}.${actualType}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateTargetFile(input: GenerateTargetFileInput): Promise<GeneratedFile> {
  const declared = input.targetConfiguration.originalFileType;
  // .xls cannot be written safely; we output .xlsx (the UI confirms this first).
  const actualType: "xlsx" | "csv" = declared === "csv" ? "csv" : "xlsx";

  if (actualType === "csv") {
    return {
      data: generateCsv(input),
      fileName: resolveFileName(input, "csv"),
      fileType: "csv",
      mimeType: "text/csv;charset=utf-8",
    };
  }

  return {
    data: await generateXlsx(input),
    fileName: resolveFileName(input, "xlsx"),
    fileType: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
