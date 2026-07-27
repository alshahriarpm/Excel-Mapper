import { TopBarSkeleton } from "@/components/molecules/page-skeleton";
import { Skeleton } from "@/components/atoms/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/atoms/ui/card";

export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <main className="mx-auto max-w-4xl p-6 lg:p-10">
        <Skeleton className="mb-4 h-4 w-16" />
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
