import { NextResponse } from 'next/server';
import { getDashboardPublic } from '@/lib/data/dashboard';
import { clientIpFromHeaders, findActiveShareLink, logPublicAccess } from '@/lib/data/supabase/public-share';
import { ApiError } from '@/lib/errors';
import { errorResponse } from '@/lib/api-response';

/**
 * Endpoint publik (Link Berbagi Laporan) - TANPA NextAuth session, validasi
 * murni via token di `public_share_links`. Pesan generik saat gagal (tak
 * bedakan "token tak ada" vs "sudah di-revoke") - lihat findActiveShareLink.
 * Data SELALU real-time (query fresh, tak ada cache/snapshot).
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const link = await findActiveShareLink(token);
    if (!link) throw new ApiError('NOT_FOUND', 'Link tidak valid atau sudah tidak aktif.');

    const data = await getDashboardPublic();
    await logPublicAccess(token, 'dashboard', {
      ipAddress: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
