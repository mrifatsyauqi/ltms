import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { communicationController } from '@/services/communication/communication.controller';
import { communicationRateLimiter } from '@/services/communication/utils/rate-limiter';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// Roles yang diizinkan untuk membagikan laporan ke Group Feishu
const ALLOWED_ROLES = new Set([
  'Super Admin',
  'Admin Cabang',
  'Manager Kota',
  'Asisten Manager Kota',
]);

/**
 * POST /api/communication/send
 * Endpoint utama pengiriman pesan & interactive card ke Feishu.
 * Dilengkapi proteksi autentikasi, permission role check, dan sliding-window rate limiter (5 req / 10s).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return unauthenticated();
  }

  // 1. Permission Role Check
  const userRole = (session.user as any)?.role || '';
  if (userRole && !ALLOWED_ROLES.has(userRole) && userRole !== 'Super Admin') {
    return NextResponse.json(
      {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Akses ditolak: Hanya Admin Cabang atau Manajemen yang memiliki wewenang membagikan laporan ke Group Feishu.',
      },
      { status: 403 }
    );
  }

  // 2. Sliding-Window Rate Limiting (5 requests per 10 seconds per user)
  const rateLimitResult = communicationRateLimiter.check(session.user.email);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'RATE_LIMITED',
        message: `Terlalu banyak permintaan kirim. Harap tunggu ${Math.ceil(rateLimitResult.resetInMs / 1000)} detik sebelum mencoba kembali.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimitResult.resetInMs / 1000)),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const response = await communicationController.handleSendMessage(
      body,
      session.user.email
    );

    return NextResponse.json(response.body, { status: response.status });
  } catch (err) {
    return errorResponse(err);
  }
}
