import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { getBablastCredentials } from '@/services/communication/communication.config';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { upsertWhatsappConfig } from '@/lib/data/supabase/whatsapp';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { apiKey, isConfigured } = await getBablastCredentials();
    
    // Mask the API Key to send to the browser (e.g. bk_live_12345678 -> bk_live_********)
    let maskedKey = '';
    if (isConfigured && apiKey) {
      const prefix = apiKey.substring(0, 10); // keep prefix like "bk_live_" if any
      maskedKey = `${prefix}${'•'.repeat(16)}`;
    }

    return NextResponse.json({
      ok: true,
      data: {
        configured: isConfigured,
        provider: 'bablast',
        connection: isConfigured ? 'connected' : 'disconnected',
        maskedKey
      }
    });
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { apiKey } = await req.json().catch(() => ({}));
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'API Key is required' }, { status: 400 });
    }

    // 1. Test the API Key before saving
    await bablastService.testConnection(apiKey);

    // 2. If valid, save to database
    await upsertWhatsappConfig('bablast', apiKey);

    // 3. Return masked response
    const prefix = apiKey.substring(0, 10);
    const maskedKey = `${prefix}${'•'.repeat(16)}`;

    return NextResponse.json({
      ok: true,
      data: {
        configured: true,
        provider: 'bablast',
        connection: 'connected',
        maskedKey
      }
    });
  } catch (error: any) {
    // The bablast service will throw mapped ApiErrors
    return errorResponse(error);
  }
}
