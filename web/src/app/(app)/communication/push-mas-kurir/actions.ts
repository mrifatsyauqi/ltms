'use server';

import { getRecentBatches, getBatchLogs } from '@/lib/data/supabase/whatsapp';
import { auth } from '@/auth';

export async function fetchRecentBatchesAction() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  return getRecentBatches();
}

export async function fetchBatchLogsAction(batchId: string) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  return getBatchLogs(batchId);
}
