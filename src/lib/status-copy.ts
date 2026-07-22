import type { RowStatus } from "@/lib/engine/types";

export type StatusTone = "success" | "warning" | "destructive" | "secondary";

/** Plain-language, HR-friendly labels for every row status. */
export const ROW_STATUS_META: Record<RowStatus, { label: string; tone: StatusTone }> = {
  ready: { label: "Ready", tone: "success" },
  missing_in_time: { label: "Missing Check-In", tone: "destructive" },
  missing_out_time: { label: "Missing Check-Out", tone: "warning" },
  next_day_record_missing: { label: "Next-Day Record Missing", tone: "warning" },
  duplicate_related_record: { label: "Duplicate Related Record", tone: "destructive" },
  no_matching_rule: { label: "No Matching Rule", tone: "destructive" },
  multiple_rules_matched: { label: "Multiple Rules Matched", tone: "warning" },
  missing_required_value: { label: "Missing Required Info", tone: "destructive" },
  duplicate: { label: "Duplicate", tone: "destructive" },
  excluded: { label: "Excluded", tone: "secondary" },
};

export function rowStatusLabel(status: RowStatus): string {
  return ROW_STATUS_META[status]?.label ?? status;
}

export function rowStatusTone(status: RowStatus): StatusTone {
  return ROW_STATUS_META[status]?.tone ?? "secondary";
}

export const TEMPLATE_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  draft: { label: "Draft", tone: "warning" },
  inactive: { label: "Inactive", tone: "secondary" },
};
