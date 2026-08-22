import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listWhatsappSenders } from '@/lib/data/supabase/communication';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const dbSenders = await listWhatsappSenders();
    let bablastSenders: any[] = [];
    try {
      bablastSenders = await bablastService.listSenders();
    } catch (e) {
      console.error('Warning: Failed to fetch live senders from Bablast', e);
    }

    // Merge live data from Bablast with DB data
    const mergedSenders = dbSenders.map(dbSender => {
      // Find matching sender by phone or sender_id
      const liveData = bablastSenders.find((s: any) => 
        s.phone === dbSender.phone || 
        s.phone === '+' + dbSender.phone ||
        String(s.id) === String(dbSender.sender_id) ||
        s.sender_code === dbSender.sender_id
      );

      return {
        ...dbSender,
        bablast_live_id: liveData?.id || null,
        sender_code: liveData?.sender_code || null,
        channel_type: liveData?.channelType || liveData?.channel_type || null,
        // Optional: you can also sync the live status if you want
        // live_status: liveData?.status || 'unknown'
      };
    });

    return NextResponse.json({
      success: true,
      data: mergedSenders,
    });
  } catch (error: any) {
    console.error('API /communication/whatsapp/senders error:', error);
    return errorResponse(error);
  }
}
