"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "destructive" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
  neutral: "text-foreground",
};

export function SummaryCard({
  label,
  value,
  tone = "neutral",
  icon,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -2 } : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-soft transition-colors",
        onClick && "cursor-pointer hover:border-primary/40",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      {icon && <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-secondary", TONE_CLASSES[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className={cn("truncate text-2xl font-semibold leading-none tabular-nums", TONE_CLASSES[tone])} title={String(value)}>
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </Comp>
  );
}
