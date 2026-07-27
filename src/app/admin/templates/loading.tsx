import { TopBarSkeleton } from "@/components/molecules/page-skeleton";
import { Skeleton } from "@/components/atoms/ui/skeleton";
import { Card, CardContent } from "@/components/atoms/ui/card";

export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <Skeleton className="mb-4 h-4 w-16" />
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-5">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
