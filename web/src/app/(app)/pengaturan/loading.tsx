import { PageHeaderSkeleton } from '@/components/layout/route-skeleton';

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="max-w-2xl space-y-3 p-3">
        <div className="bg-muted h-32 animate-pulse rounded-lg" />
      </div>
    </>
  );
}
