import { TopBarSkeleton } from "@/components/molecules/page-skeleton";
import { Skeleton } from "@/components/atoms/ui/skeleton";
import { Card, CardContent } from "@/components/atoms/ui/card";

export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="flex justify-end gap-3">
              <Skeleton className="h-11 w-28 rounded-lg" />
              <Skeleton className="h-11 w-32 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
