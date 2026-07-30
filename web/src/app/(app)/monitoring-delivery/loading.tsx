import { RouteSkeleton } from '@/components/layout/route-skeleton';

export default function Loading() {
  return <RouteSkeleton rows={6} className="p-4 md:p-8" />;
}
