import type { CellValue } from "./types";
import { cellToString } from "./normalize";

const ID_HEADER_RE = /\b(id|ids|code|no|number)\b|employee|emp\b|user|staff|worker|card|punch/i;

/** Values of one column, trimmed and de-duplicated, in first-seen order. */
export function columnValues(rows: Record<string, CellValue>[], header: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const s = cellToString(row[header] ?? null).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Which column of an uploaded roster holds the IDs. A roster exported from an HR
 * system usually carries extra columns (name, shift, date) that must not be read
 * as IDs, so prefer a header that names an identifier and fall back to the
 * column with the most values.
 */
export function pickIdColumn(rows: Record<string, CellValue>[], headers: string[]): string {
  const named = headers.filter((h) => ID_HEADER_RE.test(h));
  const pool = named.length > 0 ? named : headers;
  let best = pool[0] ?? headers[0] ?? "";
  let bestCount = -1;
  for (const h of pool) {
    const n = columnValues(rows, h).length;
    if (n > bestCount) {
      best = h;
      bestCount = n;
    }
  }
  return best;
}

/** Convenience: pick the ID column and return its values. */
export function extractIds(
  rows: Record<string, CellValue>[],
  headers: string[],
): { column: string; ids: string[] } {
  const column = pickIdColumn(rows, headers);
  return { column, ids: columnValues(rows, column) };
}
