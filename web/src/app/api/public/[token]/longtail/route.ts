import { NextResponse } from 'next/server';
import { listLongTailPublic } from '@/lib/data/longtail';
import { clientIpFromHeaders, findActiveShareLink, logPublicAccess } from '@/lib/data/supabase/public-share';
import { ApiError } from '@/lib/errors';
import { errorResponse } from '@/lib/api-response';

/**
 * Endpoint publik (Link Berbagi Laporan) utk halaman Data Long Tail - pola
 * sama persis dgn /api/public/[token]/dashboard (lihat komentar di sana):
 * tanpa NextAuth, validasi murni via token, pesan generik saat gagal, data
 * selalu real-time. Endpoint TERPISAH dari /api/longtail internal (bukan
 * reuse) - selalu "Semua DP", tak menerima parameter filter dp apa pun.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const link = await findActiveShareLink(token);
    if (!link) throw new ApiError('NOT_FOUND', 'Link tidak valid atau sudah tidak aktif.');

    const data = await listLongTailPublic();
    await logPublicAccess(token, 'data-longtail', {
      ipAddress: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
