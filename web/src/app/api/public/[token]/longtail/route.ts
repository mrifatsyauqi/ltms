import { NextResponse } from 'next/server';
import { listLongTailPublic } from '@/lib/data/longtail';
import {
  RATE_LIMIT_LONGTAIL_MAX,
  clientIpFromHeaders,
  findActiveShareLink,
  isRateLimited,
  logPublicAccess,
} from '@/lib/data/supabase/public-share';
import { ApiError } from '@/lib/errors';
import { errorResponse } from '@/lib/api-response';

/**
 * Endpoint publik (Link Berbagi Laporan) utk halaman Data Long Tail - pola
 * sama persis dgn /api/public/[token]/dashboard (lihat komentar di sana):
 * tanpa NextAuth, validasi murni via token, pesan generik saat gagal, data
 * selalu real-time. Endpoint TERPISAH dari /api/longtail internal (bukan
 * reuse) - selalu "Semua DP", tak menerima parameter filter dp apa pun.
 * Rate limit LEBIH KETAT drpd Dashboard (RATE_LIMIT_LONGTAIL_MAX) - data
 * per-baris jauh lebih besar volumenya per request.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const link = await findActiveShareLink(token);
    if (!link) throw new ApiError('NOT_FOUND', 'Link tidak valid atau sudah tidak aktif.');
    if (await isRateLimited(token, 'data-longtail', RATE_LIMIT_LONGTAIL_MAX)) {
      throw new ApiError('RATE_LIMITED', 'Terlalu banyak permintaan, coba lagi nanti.');
    }

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
