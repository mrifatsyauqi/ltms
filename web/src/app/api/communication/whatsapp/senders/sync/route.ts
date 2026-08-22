import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { upsertWhatsappSenders } from '@/lib/data/supabase/communication';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    // Optional: check user roles here if needed
    // const role = (session.user as any).role;

    // 1. Fetch from Bablast SDK
    const bablastSenders = await bablastService.listSenders();
    
    // 2. Transform to DB schema
    const upsertPayload = bablastSenders.map((s: any) => ({
      sender_id: s.sender_code || s.id || String(s.id_sender || s.senderId), // handling possible SDK fields
      phone: s.phone || s.phone_number || s.msisdn || null,
      display_name: s.name || s.display_name || s.sender_name || null,
      status: s.status === 1 || s.status === 'connected' || s.status?.toLowerCase() === 'connected' ? 'connected' : 'disconnected',
    }));

    // 3. Upsert to DB
    const syncedRecords = await upsertWhatsappSenders(upsertPayload, session.user.email);

    return NextResponse.json({
      success: true,
      message: 'Successfully synced WhatsApp senders from Bablast',
      data: syncedRecords,
    });
  } catch (err: any) {
    console.error('API /communication/whatsapp/senders/sync error:', err);
    return errorResponse(err);
  }
}
