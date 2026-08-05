import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { communicationController } from '@/services/communication/communication.controller';
import { communicationAuthService } from '@/services/communication/utils/authorization';
import { communicationRateLimiter } from '@/services/communication/utils/rate-limiter';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/communication/send
 * Endpoint utama pengiriman pesan & interactive card ke Feishu.
 * Dilindungi Middleware Authorization Scope & sliding-window rate limiter (5 req / 10s).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return unauthenticated();
  }

  // 1. Sliding-Window Rate Limiting (5 requests per 10 seconds per user)
  const rateLimitResult = communicationRateLimiter.check(session.user.email);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'RATE_LIMITED',
        message: `Terlalu banyak permintaan kirim. Harap tunggu ${Math.ceil(
          rateLimitResult.resetInMs / 1000
        )} detik sebelum mencoba kembali.`,
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

    // 2. Authorization Layer: Validasi Role & Data Scope User
    await communicationAuthService.authorizeSend(session.user.email, body);

    // 3. Eksekusi pengiriman pesan melalui Communication Controller
    const response = await communicationController.handleSendMessage(
      body,
      session.user.email
    );

    return NextResponse.json(response.body, { status: response.status });
  } catch (err: any) {
    return errorResponse(err);
  }
}
