import { TopBarSkeleton, PageHeaderSkeleton, CardGridSkeleton } from "@/components/molecules/page-skeleton";

export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <PageHeaderSkeleton eyebrow />
        <CardGridSkeleton count={4} cols="sm:grid-cols-2" />
      </main>
    </>
  );
}
