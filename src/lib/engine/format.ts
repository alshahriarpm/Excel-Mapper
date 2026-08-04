import type { CellValue, TargetColumnConfiguration } from "./types";
import { cellToString, isBlank, parseCalendarDate } from "./normalize";

export type TimeParts = { hours: number; minutes: number; seconds: number };

export function parseTime(value: CellValue): TimeParts | null {
  if (isBlank(value)) return null;
  if (value instanceof Date) {
    return { hours: value.getHours(), minutes: value.getMinutes(), seconds: value.getSeconds() };
  }
  if (typeof value === "number") {
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

export function timeToFraction(parts: TimeParts): number {
  return (parts.hours * 3600 + parts.minutes * 60 + parts.seconds) / 86_400;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function patternOr(format: string | undefined, fallback: string): string {
  const f = (format ?? "").trim();
  return f === "" ? fallback : f;
}

export function formatDate(value: CellValue, formatPattern?: string): string {
  const format = patternOr(formatPattern, "YYYY-MM-DD");
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

export function formatTime(value: CellValue, formatPattern?: string): string {
  const format = patternOr(formatPattern, "HH:mm");
  const t = parseTime(value);
  if (!t) return cellToString(value);
  const is12h = /am\/pm/i.test(format) || /\ba\/p\b/i.test(format);
  const isPm = t.hours >= 12;
  const hour = is12h ? (t.hours % 12 === 0 ? 12 : t.hours % 12) : t.hours;
  const marker = String.fromCharCode(1);
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

export function toExcelNumFmt(
  type: TargetColumnConfiguration["detectedType"],
  format?: TargetColumnFormatLike,
): string | undefined {
  if (type === "date") return patternOr(format?.dateFormat, "yyyy-mm-dd").toLowerCase();
  if (type === "time") {
    return patternOr(format?.timeFormat, "hh:mm").replace(/AM\/PM/gi, "AM/PM");
  }
  if (type === "number" && format?.numberFormat) return format.numberFormat;
  if (type === "text" && format?.preserveLeadingZeros) return "@";
  return undefined;
}

type TargetColumnFormatLike = NonNullable<TargetColumnConfiguration["format"]>;

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
