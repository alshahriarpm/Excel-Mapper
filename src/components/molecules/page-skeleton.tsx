import { Skeleton } from "@/components/atoms/ui/skeleton";
import { Card, CardContent } from "@/components/atoms/ui/card";

export function TopBarSkeleton() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            BM
          </span>
          <span className="text-sm font-semibold">Bulk Mapper</span>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="hidden h-4 w-40 sm:block" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </header>
  );
}

export function PageHeaderSkeleton({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div className="mb-8 space-y-2">
      {eyebrow && <Skeleton className="h-4 w-28" />}
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function CardGridSkeleton({ count = 3, cols = "sm:grid-cols-3" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="h-full">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-11 w-11 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
