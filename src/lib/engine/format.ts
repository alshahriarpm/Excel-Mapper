/**
 * Output formatting helpers.
 *
 * Values are formatted using the TARGET file's own saved formats (spec §34):
 *   - text preserves leading zeros ("00125" stays "00125"),
 *   - dates use the saved target date format,
 *   - times use the saved target time format,
 *   - blanks are written empty (never "null"/"undefined"/"N/A") unless the
 *     target explicitly configures a placeholder.
 */
import type { CellValue, TargetColumnConfiguration } from "./types";
import { cellToString, isBlank, parseCalendarDate } from "./normalize";

export type TimeParts = { hours: number; minutes: number; seconds: number };

/** Parse a cell into time-of-day parts. Returns null if not time-like. */
export function parseTime(value: CellValue): TimeParts | null {
  if (isBlank(value)) return null;
  if (value instanceof Date) {
    return { hours: value.getHours(), minutes: value.getMinutes(), seconds: value.getSeconds() };
  }
  if (typeof value === "number") {
    // Excel stores time as a fraction of a day; a serial's fractional part is
    // the time component.
    const frac = value - Math.floor(value);
    const totalSeconds = Math.round(frac * 86_400);
    return {
      hours: Math.floor(totalSeconds / 3600) % 24,
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = m[3] ? Number(m[3]) : 0;
  const ampm = m[4]?.toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return { hours, minutes, seconds };
}

/** Time-of-day as a fraction of a day (for Excel numeric time cells). */
export function timeToFraction(parts: TimeParts): number {
  return (parts.hours * 3600 + parts.minutes * 60 + parts.seconds) / 86_400;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/** Format a calendar date using a token format like "DD/MM/YYYY" (case-insensitive). */
export function formatDate(value: CellValue, format = "YYYY-MM-DD"): string {
  const d = parseCalendarDate(value);
  if (!d) return cellToString(value);
  const map: Record<string, string> = {
    YYYY: String(d.year),
    YY: pad(d.year % 100),
    MM: pad(d.month),
    M: String(d.month),
    DD: pad(d.day),
    D: String(d.day),
  };
  return format.toUpperCase().replace(/YYYY|YY|MM|M|DD|D/g, (t) => map[t] ?? t);
}

/**
 * Format a time using a token format like "h:mm AM/PM" or "HH:mm".
 * Case-insensitive; 12-hour when the format contains AM/PM, else 24-hour.
 */
export function formatTime(value: CellValue, format = "HH:mm"): string {
  const t = parseTime(value);
  if (!t) return cellToString(value);
  const is12h = /am\/pm/i.test(format) || /\ba\/p\b/i.test(format);
  const isPm = t.hours >= 12;
  const hour = is12h ? (t.hours % 12 === 0 ? 12 : t.hours % 12) : t.hours;
  // Protect the AM/PM token first (its "M" must not be eaten by the minutes
  // replacement), substitute the numeric tokens, then restore AM/PM last.
  const marker = String.fromCharCode(1); // contains no format letters
  return format
    .replace(/AM\/PM/gi, marker)
    .replace(/hh/gi, pad(hour))
    .replace(/h/gi, String(hour))
    .replace(/mm/gi, pad(t.minutes))
    .replace(/m/gi, String(t.minutes))
    .replace(/ss/gi, pad(t.seconds))
    .replace(/s/gi, String(t.seconds))
    .split(marker)
    .join(isPm ? "PM" : "AM");
}

/** Convert a saved target format into an Excel number-format string. */
export function toExcelNumFmt(
  type: TargetColumnConfiguration["detectedType"],
  format?: TargetColumnFormatLike,
): string | undefined {
  if (type === "date") return (format?.dateFormat ?? "yyyy-mm-dd").toLowerCase();
  if (type === "time") {
    const f = format?.timeFormat ?? "hh:mm";
    return f.replace(/AM\/PM/gi, "AM/PM");
  }
  if (type === "number" && format?.numberFormat) return format.numberFormat;
  if (type === "text" && format?.preserveLeadingZeros) return "@";
  return undefined;
}

type TargetColumnFormatLike = NonNullable<TargetColumnConfiguration["format"]>;

/** Produce the display/CSV string for a value according to its column config. */
export function formatCellForDisplay(value: CellValue, col: TargetColumnConfiguration): string {
  if (isBlank(value)) return col.format?.blankPlaceholder ?? "";
  switch (col.detectedType) {
    case "date":
      return formatDate(value, col.format?.dateFormat);
    case "time":
      return formatTime(value, col.format?.timeFormat);
    case "datetime":
      return `${formatDate(value, col.format?.dateFormat)} ${formatTime(value, col.format?.timeFormat)}`.trim();
    case "number":
      return cellToString(value);
    case "text":
    default:
      return cellToString(value);
  }
}
