export const THEME_COOKIE = "bm-theme";
export const THEME_STORAGE_KEY = "bulk-mapper:theme";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function parseTheme(value: unknown, fallback: Theme = "system"): Theme {
  return isTheme(value) ? value : fallback;
}
