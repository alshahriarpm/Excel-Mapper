import ExcelJS from "exceljs";
import type {
  CellValue,
  TargetColumnType,
  TargetColumnFormat,
  TargetFrozenPaneConfiguration,
} from "./types";
import { normalizeHeader } from "./normalize";

export type ParsedColumn = {
  header: string;
  displayName: string;
  order: number;
  required: boolean;
  sample: CellValue;
  detectedType: TargetColumnType;
  format?: TargetColumnFormat;
  isBlankColumn: boolean;
};

export type ParsedSheet = {
  name: string;
  rows: CellValue[][];
  detectedHeaderRow: number;
  staticRowsAboveHeader: CellValue[][];
  columns: ParsedColumn[];
  frozenPane?: TargetFrozenPaneConfiguration;
};

export type ParsedWorkbook = {
  fileName: string;
  fileType: "xlsx" | "xls" | "csv";
  worksheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  suggestedWorksheet: string;
  workbookSnapshot?: string;
};


function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  return Buffer.from(bytes).toString("base64");
}

function toUint8(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}


function extractCellValue(raw: ExcelJS.CellValue): CellValue {
  if (raw == null) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") return raw;
  if (typeof raw === "object") {
    if ("richText" in raw && Array.isArray(raw.richText)) {
      return raw.richText.map((r) => r.text).join("");
    }
    if ("text" in raw && typeof raw.text === "string") return raw.text;
    if ("result" in raw) {
      const r = raw.result;
      if (r instanceof Date || typeof r === "number" || typeof r === "string" || typeof r === "boolean") {
        return r;
      }
      return null;
    }
    if ("error" in raw) return null;
  }
  return null;
}

const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?(\s*[AaPp][Mm])?$/;
const DATE_RE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;

function detectType(value: CellValue, numFmt?: string): { type: TargetColumnType; format?: TargetColumnFormat } {
  if (numFmt) {
    const f = numFmt.toLowerCase();
    const hasDate = /[dy]/.test(f) && !/^\[/.test(f);
    const hasTime = /h/.test(f) || /am\/pm/.test(f);
    if (hasDate && hasTime) return { type: "datetime", format: { dateFormat: numFmt, timeFormat: numFmt } };
    if (hasTime) return { type: "time", format: { timeFormat: numFmt } };
    if (hasDate) return { type: "date", format: { dateFormat: numFmt } };
    if (/[0#]/.test(f) && !/@/.test(f)) return { type: "number", format: { numberFormat: numFmt } };
    if (f === "@") return { type: "text", format: { preserveLeadingZeros: true } };
  }
  if (value instanceof Date) return { type: "date", format: { dateFormat: "DD/MM/YYYY" } };
  if (typeof value === "number") return { type: "number" };
  if (typeof value === "string") {
    if (TIME_RE.test(value.trim())) return { type: "time", format: { timeFormat: "h:mm AM/PM" } };
    if (DATE_RE.test(value.trim())) return { type: "date", format: { dateFormat: "DD/MM/YYYY" } };
    if (/^0\d+$/.test(value.trim())) return { type: "text", format: { preserveLeadingZeros: true } };
  }
  return { type: "text" };
}


function countNonEmpty(row: CellValue[]): number {
  return row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
}

const META_WORDS_RE = /\b(meta|metadata|reference|readme|instructions?|lookup|dropdowns?|config|settings|notes?|guide|help|about|cover)\b/i;
function isMetadataSheet(name: string): boolean {
  if (/^_/.test(name)) return true;
  const normalized = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .trim();
  return META_WORDS_RE.test(normalized);
}
function worksheetPriority(name: string, populated: number): number {
  const bonus = !isMetadataSheet(name) && populated > 0 ? 1_000_000_000 : 0;
  return bonus + populated;
}

function detectHeaderRow(rows: CellValue[][]): number {
  const limit = Math.min(rows.length, 15);
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < limit; i++) {
    const count = countNonEmpty(rows[i] ?? []);
    const hasDataBelow = i + 1 < rows.length && countNonEmpty(rows[i + 1] ?? []) > 0;
    const score = count + (hasDataBelow ? 0.5 : 0);
    if (score > bestCount) {
      bestCount = score;
      best = i;
    }
  }
  return best + 1;
}


function stripRequiredMarker(header: string): { displayName: string; required: boolean } {
  const required = /\*\s*$/.test(header);
  return { displayName: header.replace(/\*+\s*$/, "").trim(), required };
}

function analyzeSheet(
  name: string,
  rows: CellValue[][],
  formats: (string | undefined)[][],
  frozenPane?: TargetFrozenPaneConfiguration,
  forcedHeaderRow?: number,
): ParsedSheet {
  const detectedHeaderRow = forcedHeaderRow ?? detectHeaderRow(rows);
  const headerIdx = detectedHeaderRow - 1;
  const headerRow = rows[headerIdx] ?? [];
  const sampleRow = rows[headerIdx + 1] ?? [];
  const sampleFmt = formats[headerIdx + 1] ?? [];

  let lastHeaderCol = -1;
  headerRow.forEach((h, j) => {
    if (h !== null && String(h).trim() !== "") lastHeaderCol = j;
  });

  const columns: ParsedColumn[] = [];
  for (let j = 0; j <= lastHeaderCol; j++) {
    const rawHeader = headerRow[j];
    const header = rawHeader == null ? "" : String(rawHeader);
    const isBlankColumn = header.trim() === "";
    const { displayName, required } = stripRequiredMarker(header);
    const sample = sampleRow[j] ?? null;
    const { type, format } = detectType(sample, sampleFmt[j]);
    columns.push({
      header,
      displayName: isBlankColumn ? `Column ${j + 1}` : displayName,
      order: j,
      required,
      sample,
      detectedType: isBlankColumn ? "unknown" : type,
      format,
      isBlankColumn,
    });
  }

  return {
    name,
    rows,
    detectedHeaderRow,
    staticRowsAboveHeader: rows.slice(0, headerIdx),
    columns,
    frozenPane,
  };
}


async function parseXlsx(bytes: Uint8Array): Promise<Omit<ParsedWorkbook, "fileName" | "fileType" | "workbookSnapshot">> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);

  const sheets: Record<string, ParsedSheet> = {};
  const worksheetNames: string[] = [];
  let suggested = "";
  let suggestedScore = -1;

  workbook.eachSheet((worksheet) => {
    worksheetNames.push(worksheet.name);
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;
    const rows: CellValue[][] = [];
    const formats: (string | undefined)[][] = [];

    for (let r = 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const values: CellValue[] = [];
      const fmts: (string | undefined)[] = [];
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        values.push(extractCellValue(cell.value));
        fmts.push(cell.numFmt || undefined);
      }
      rows.push(values);
      formats.push(fmts);
    }

    let frozenPane: TargetFrozenPaneConfiguration | undefined;
    const view = worksheet.views?.[0];
    if (view && view.state === "frozen") {
      frozenPane = { frozenColumns: view.xSplit ?? 0, frozenRows: view.ySplit ?? 0 };
    }

    const sheet = analyzeSheet(worksheet.name, rows, formats, frozenPane);
    sheet.columns.forEach((col) => {
      const width = worksheet.getColumn(col.order + 1).width;
      if (width) col.format = { ...col.format };
    });
    sheets[worksheet.name] = sheet;

    const populated = rows.reduce((sum, row) => sum + countNonEmpty(row), 0);
    const priority = worksheetPriority(worksheet.name, populated);
    if (priority > suggestedScore) {
      suggestedScore = priority;
      suggested = worksheet.name;
    }
  });

  return { worksheetNames, sheets, suggestedWorksheet: suggested };
}


function extractXlsCellValue(cell: { t?: string; v?: unknown } | undefined): CellValue {
  if (!cell || cell.v == null || cell.t === "e") return null;
  const v = cell.v;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  return null;
}

async function parseXls(
  bytes: Uint8Array,
): Promise<Omit<ParsedWorkbook, "fileName" | "fileType" | "workbookSnapshot">> {
  const XLSX = await import("xlsx");

  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(bytes, { type: "array", cellDates: true, cellNF: true });
  } catch {
    throw new ParseError(
      "We couldn't read that .xls file — it may be corrupted or password-protected. Try re-saving it as .xlsx.",
    );
  }

  const sheets: Record<string, ParsedSheet> = {};
  const worksheetNames: string[] = [];
  let suggested = "";
  let suggestedScore = -1;

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    worksheetNames.push(name);
    const rows: CellValue[][] = [];
    const formats: (string | undefined)[][] = [];

    const ref = ws?.["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        const values: CellValue[] = [];
        const fmts: (string | undefined)[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws![addr] as { t?: string; v?: unknown; z?: unknown } | undefined;
          values.push(extractXlsCellValue(cell));
          fmts.push(cell && typeof cell.z === "string" ? cell.z : undefined);
        }
        rows.push(values);
        formats.push(fmts);
      }
    }

    sheets[name] = analyzeSheet(name, rows, formats);

    const populated = rows.reduce((sum, row) => sum + countNonEmpty(row), 0);
    const priority = worksheetPriority(name, populated);
    if (priority > suggestedScore) {
      suggestedScore = priority;
      suggested = name;
    }
  }

  if (suggestedScore < 1) {
    throw new ParseError(
      "We couldn't find any data in that .xls file — it may be empty, corrupted, or password-protected. Try re-saving it as .xlsx.",
    );
  }

  return { worksheetNames, sheets, suggestedWorksheet: suggested };
}


function parseCsvText(text: string): CellValue[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const stripped = text.replace(/^﻿/, "");
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && stripped[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) =>
    r.map((v) => {
      const t = v.trim();
      if (t !== "" && /^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t)) return Number(t);
      return v;
    }),
  );
}


function detectFileType(fileName: string): "xlsx" | "xls" | "csv" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xls")) return "xls";
  return "xlsx";
}

export async function parseWorkbook(
  input: ArrayBuffer | Uint8Array | string,
  fileName: string,
): Promise<ParsedWorkbook> {
  const fileType = detectFileType(fileName);

  if (fileType === "csv") {
    const text = typeof input === "string" ? input : new TextDecoder().decode(toUint8(input));
    const rows = parseCsvText(text);
    const formats = rows.map((r) => r.map(() => undefined));
    const sheet = analyzeSheet("CSV", rows, formats);
    return {
      fileName,
      fileType,
      worksheetNames: ["CSV"],
      sheets: { CSV: sheet },
      suggestedWorksheet: "CSV",
    };
  }

  if (fileType === "xls") {
    const xlsBytes = typeof input === "string" ? new TextEncoder().encode(input) : toUint8(input);
    const parsed = await parseXls(xlsBytes);
    return { fileName, fileType, ...parsed };
  }

  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : toUint8(input);
  const parsed = await parseXlsx(bytes);
  return {
    fileName,
    fileType,
    ...parsed,
    workbookSnapshot: bytesToBase64(bytes),
  };
}

export class ParseError extends Error {}

export function sheetToSourceRows(sheet: ParsedSheet): Record<string, CellValue>[] {
  const headers = sheet.columns.map((c) => c.header || `Column ${c.order + 1}`);
  const dataRows = sheet.rows.slice(sheet.detectedHeaderRow);
  return dataRows
    .filter((row) => countNonEmpty(row) > 0)
    .map((row) => {
      const obj: Record<string, CellValue> = {};
      headers.forEach((h, j) => {
        obj[h] = row[sheet.columns[j]!.order] ?? null;
      });
      return obj;
    });
}

export function headerSignature(headers: string[]): string[] {
  return headers.map(normalizeHeader);
}

export function reanalyzeSheet(sheet: ParsedSheet, headerRow: number): ParsedSheet {
  const formats = sheet.rows.map((r) => r.map(() => undefined));
  return analyzeSheet(sheet.name, sheet.rows, formats, sheet.frozenPane, headerRow);
}
