import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CardRenderPipeline } from '@/services/communication/configuration/card-render-pipeline.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

/**
 * POST /api/communication/card-templates/preview
 *
 * Server-only compile endpoint. The browser must never generate Feishu card
 * JSON itself — Card Builder Preview, Share Dialog Preview, and History
 * Preview all call this route (through CardRenderPipeline, the exact same
 * pipeline used to compile the card actually sent to Feishu) so the four
 * surfaces can never diverge.
 *
 * Body: { module: string, cardConfig?: VisualCardBlocksConfig, cardTemplateId?: string, data?: Record<string, any>, imageKey?: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await request.json();

    if (!body.module || typeof body.module !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'Parameter module wajib diisi');
    }

    const { cardJson, blocksConfig } = await CardRenderPipeline.compile({
      module: body.module,
      cardConfig: body.cardConfig,
      cardTemplateId: body.cardTemplateId,
      data: body.data,
      imageKey: body.imageKey,
    });

    return NextResponse.json({ ok: true, data: { cardJson, blocksConfig } });
  } catch (err) {
    return errorResponse(err);
  }
}
