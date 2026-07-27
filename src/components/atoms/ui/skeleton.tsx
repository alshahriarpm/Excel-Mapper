import { cn } from "@/lib/utils";

/** Animated placeholder block shown while content loads. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
