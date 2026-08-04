import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function OpenHint({ label = "Open", className }: { label?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-3 flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
        className,
      )}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
    </span>
  );
}
