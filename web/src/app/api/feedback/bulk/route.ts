import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { bulkSubmitFeedback } from '@/lib/data/longtail';
import { errorResponse, unauthenticated } from '@/lib/api-response';

/**
 * POST /api/feedback/bulk
 * Terapkan SATU feedback ke BANYAK waybill sekaligus - lihat
 * bulkSubmitFeedback() (lib/data/supabase/longtail.ts) utk kenapa ini
 * memanggil submitFeedback() yang sama per baris, bukan logic terpisah.
 * Selalu 200 OK dgn ringkasan sebagian gagal (bukan all-or-nothing) -
 * KECUALI validasi awal (body kosong / lebih dari batas maksimal), yang
 * memang menolak SELURUH request sebelum satu baris pun diproses.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { items, feedback } = await request.json();
  try {
    const data = await bulkSubmitFeedback(session.user.email, items, feedback);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
