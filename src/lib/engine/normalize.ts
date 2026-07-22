/**
 * Normalization primitives: text matching, header matching, blank detection,
 * and robust calendar-date parsing.
 *
 * All matching behavior is driven by configuration (MatchNormalization) — the
 * engine never assumes a fixed casing/spacing/alias policy.
 */
import type { CellValue, MatchNormalization } from "./types";

/** True for values that count as empty/blank. */
export function isBlank(value: CellValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Display/serialization of a cell as plain text (no locale magic). */
export function cellToString(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

/**
 * Normalize a header for equivalence matching. Treats
 *   "A M OnDuty", "A M  OnDuty", "A M OnDuty " as the same key.
 */
export function normalizeHeader(header: string): string {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Apply the configured normalization to a value for condition matching. */
export function normalizeForMatch(value: CellValue, n: MatchNormalization): string {
  let s = cellToString(value);
  if (n.trimSpaces) s = s.trim();
  if (n.collapseSpaces) s = s.replace(/\s+/g, " ");
  if (n.ignoreCase) s = s.toLowerCase();
  return s;
}

/**
 * Resolve a value to its alias-group canonical form. If the value belongs to a
 * group, the group's first member (normalized) is returned as the canonical
 * key; otherwise the normalized value itself.
 */
export function canonicalAlias(value: CellValue, n: MatchNormalization): string {
  const norm = normalizeForMatch(value, n);
  for (const group of n.aliasGroups ?? []) {
    for (const member of group) {
      if (normalizeForMatch(member, n) === norm) {
        return normalizeForMatch(group[0] ?? member, n);
      }
    }
  }
  return norm;
}

// ---------------------------------------------------------------------------
// Date parsing — canonical yyyy-mm-dd, with Excel serial + string support
// ---------------------------------------------------------------------------

/** A parsed calendar date, independent of timezone. */
export type ParsedDate = { iso: string; year: number; month: number; day: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function makeParsed(year: number, month: number, day: number): ParsedDate | null {
  // Validate via UTC round-trip to reject impossible dates like 31/02.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return { iso: `${year}-${pad(month)}-${pad(day)}`, year, month, day };
}

/** Convert an Excel serial number to a calendar date (1900 date system). */
function fromExcelSerial(serial: number): ParsedDate | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  // Excel's day 0 is 1899-12-30 (accounts for the fictional 1900-02-29).
  const ms = Math.round(serial) * 86_400_000;
  const base = Date.UTC(1899, 11, 30);
  const d = new Date(base + ms);
  return makeParsed(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Determine token order (day/month/year) from a format hint like "DD/MM/YYYY". */
function orderFromFormat(format?: string): ["d" | "m" | "y", "d" | "m" | "y", "d" | "m" | "y"] | null {
  if (!format) return null;
  const tokens = format.toUpperCase().match(/[DMY]+/g);
  if (!tokens || tokens.length < 3) return null;
  const order = tokens.slice(0, 3).map((t) => t[0]!.toLowerCase()) as (
    | "d"
    | "m"
    | "y"
  )[];
  const set = new Set(order);
  if (set.size !== 3 || !set.has("d") || !set.has("m") || !set.has("y")) return null;
  return [order[0]!, order[1]!, order[2]!];
}

/**
 * Parse a string date. Tries, in order:
 *   1. ISO yyyy-mm-dd (unambiguous)
 *   2. The provided format hint's token order
 *   3. Day-first heuristic (14/07/2026), falling back to month-first
 */
function parseDateString(raw: string, formatHint?: string): ParsedDate | null {
  const s = raw.trim();
  if (s === "") return null;

  // ISO first — unambiguous.
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    return makeParsed(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const parts = s.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
  if (!parts) {
    // Last resort: let the JS engine try (e.g. "14 Jul 2026").
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return makeParsed(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    return null;
  }

  const a = Number(parts[1]);
  const b = Number(parts[2]);
  const c = Number(parts[3]);

  const order = orderFromFormat(formatHint);
  if (order) {
    const map: Record<"d" | "m" | "y", number> = { d: 0, m: 0, y: 0 };
    [a, b, c].forEach((val, i) => {
      map[order[i]!] = val;
    });
    const result = makeParsed(map.y, map.m, map.d);
    if (result) return result;
  }

  // Heuristic: if the first component is clearly a day (>12), it's day-first.
  if (a > 12 && b <= 12) return makeParsed(c, b, a);
  // If the second component is clearly a day, it's month-first.
  if (b > 12 && a <= 12) return makeParsed(c, a, b);
  // Ambiguous — default to day-first (common outside the US; matches the
  // 14/07/2026 style used in the spec examples).
  return makeParsed(c, b, a) ?? makeParsed(c, a, b);
}

/** Parse any supported cell value into a canonical calendar date. */
export function parseCalendarDate(value: CellValue, formatHint?: string): ParsedDate | null {
  if (isBlank(value)) return null;
  if (value instanceof Date) {
    return makeParsed(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") {
    return fromExcelSerial(value);
  }
  return parseDateString(String(value), formatHint);
}

/** Add (or subtract) whole calendar days to an ISO date, returning ISO. */
export function addCalendarDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(
    next.getUTCDate(),
  )}`;
}
