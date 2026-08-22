import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listWhatsappSenders } from '@/lib/data/supabase/communication';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const senders = await listWhatsappSenders();
    return NextResponse.json({
      success: true,
      data: senders,
    });
  } catch (error: any) {
    console.error('API /communication/whatsapp/senders error:', error);
    return errorResponse(error);
  }
}
