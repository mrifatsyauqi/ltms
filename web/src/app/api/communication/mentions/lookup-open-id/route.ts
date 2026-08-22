import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { feishuContactService } from '@/services/communication/providers/feishu/contact.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

/**
 * POST /api/communication/mentions/lookup-open-id
 * Body: { phone: string }
 * Mencari Open ID Feishu (khusus utk app/bot LTMS ini) dari nomor HP, via
 * Contact API resmi Feishu (contact/v3/users/batch_get_id) - satu-satunya
 * cara yang terjamin akurat, karena Open ID di-scope per-app.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw new ApiError('VALIDATION_ERROR', 'Nomor HP wajib diisi');
    }

    const result = await feishuContactService.lookupOpenIdByMobile(phone.trim());

    if (!result) {
      throw new ApiError(
        'NOT_FOUND',
        'Nomor HP ini tidak terdaftar di tenant Feishu Anda (atau belum pernah membuka app/bot LTMS)'
      );
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return errorResponse(err);
  }
}
