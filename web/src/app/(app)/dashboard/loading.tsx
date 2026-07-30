import { PageHeaderSkeleton } from '@/components/layout/route-skeleton';
import { StatSkeleton } from '@/components/dashboard/dashboard-client';

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="space-y-2.5 p-3">
        <StatSkeleton />
      </div>
    </>
  );
}
