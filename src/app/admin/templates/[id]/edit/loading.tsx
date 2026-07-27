import { TopBarSkeleton } from "@/components/molecules/page-skeleton";
import { Skeleton } from "@/components/atoms/ui/skeleton";
import { Card, CardContent } from "@/components/atoms/ui/card";

export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <div className="mx-auto max-w-6xl px-6 pt-4 lg:px-10">
        <Skeleton className="h-4 w-16" />
      </div>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:flex-row lg:p-10">
        <aside className="space-y-3 lg:w-[300px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </aside>
        <Card className="flex-1">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="space-y-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
