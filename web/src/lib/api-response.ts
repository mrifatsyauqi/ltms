import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/errors';

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VERSION_CONFLICT: 409, // optimistic lock: data server sudah berubah (Bagian 9.4)
  VALIDATION_ERROR: 422,
  LOCK_TIMEOUT: 503,
  RATE_LIMITED: 429, // Link Berbagi Laporan (public share) - lihat public-share.ts isRateLimited
};

export function unauthenticated() {
  return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    let status = STATUS_BY_CODE[err.code] ?? 400;
    // Allow numeric string codes passed by third-party wrappers
    if (/^\d{3}$/.test(err.code)) {
      status = parseInt(err.code, 10);
    }
    return NextResponse.json(
      { ok: false, error: err.code, message: err.message, data: err.data },
      { status },
    );
  }
  return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
}
