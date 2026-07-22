import { Badge } from "@/components/atoms/ui/badge";
import type { RowStatus } from "@/lib/engine/types";
import { rowStatusLabel, rowStatusTone } from "@/lib/status-copy";

const TONE_TO_VARIANT = {
  success: "success",
  warning: "warning",
  destructive: "destructive",
  secondary: "secondary",
} as const;

export function StatusBadge({ status }: { status: RowStatus }) {
  const tone = rowStatusTone(status);
  return <Badge variant={TONE_TO_VARIANT[tone]}>{rowStatusLabel(status)}</Badge>;
}
