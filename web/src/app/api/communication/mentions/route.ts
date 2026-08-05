import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mentionService } from '@/services/communication/configuration/mention.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

/**
 * GET /api/communication/mentions
 * Query parameters: scope_type, search, is_active
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { searchParams } = new URL(request.url);
    const scope_type = (searchParams.get('scope_type') as any) || undefined;
    const search = searchParams.get('search') || undefined;
    const is_active_param = searchParams.get('is_active');
    const is_active = is_active_param !== null ? is_active_param === 'true' : undefined;

    const list = await mentionService.listMappings({
      scope_type,
      search,
      is_active,
    });

    return NextResponse.json({ ok: true, data: list });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/communication/mentions
 * Body: { scope_type, scope_key, pic_name, role?, feishu_open_id?, feishu_user_id?, phone?, is_active? }
 * or bulk: { bulk: true, items: [...] }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await request.json();

    if (body.bulk && Array.isArray(body.items)) {
      const createdList = [];
      for (const item of body.items) {
        if (!item.scope_type || !item.scope_key || !item.pic_name) continue;
        const created = await mentionService.create({
          scope_type: item.scope_type,
          scope_key: item.scope_key,
          pic_name: item.pic_name,
          role: item.role,
          feishu_open_id: item.feishu_open_id,
          feishu_user_id: item.feishu_user_id,
          phone: item.phone,
          is_active: item.is_active ?? true,
        });
        createdList.push(created);
      }
      return NextResponse.json({ ok: true, data: createdList, count: createdList.length });
    }

    if (!body.scope_type || !body.scope_key || !body.pic_name) {
      throw new ApiError('VALIDATION_ERROR', 'Parameter scope_type, scope_key, dan pic_name wajib diisi');
    }

    const created = await mentionService.create({
      scope_type: body.scope_type,
      scope_key: body.scope_key,
      pic_name: body.pic_name,
      role: body.role,
      feishu_open_id: body.feishu_open_id,
      feishu_user_id: body.feishu_user_id,
      phone: body.phone,
      is_active: body.is_active ?? true,
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
