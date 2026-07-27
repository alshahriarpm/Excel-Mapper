import { TopBarSkeleton, PageHeaderSkeleton, CardGridSkeleton } from "@/components/molecules/page-skeleton";
import { Skeleton } from "@/components/atoms/ui/skeleton";

export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <PageHeaderSkeleton eyebrow />
        <CardGridSkeleton count={3} />
        <div className="mt-10 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </main>
    </>
  );
}
