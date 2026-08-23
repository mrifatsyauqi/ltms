'use server';

import { getRecentBatches, getBatchLogs, getRecentLogs } from '@/lib/data/supabase/whatsapp';
import { auth } from '@/auth';

export async function fetchRecentBatchesAction() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  
  const isSuperAdmin = (session.user as any).role === 'Super Admin';
  const dpId = isSuperAdmin ? undefined : (session.user as any).dropPoint;
  
  return getRecentBatches(dpId);
}

export async function fetchBatchLogsAction(batchId: string) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  return getBatchLogs(batchId);
}

export async function fetchRecentLogsAction() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  return getRecentLogs();
}
