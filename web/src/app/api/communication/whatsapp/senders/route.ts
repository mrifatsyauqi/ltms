import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listWhatsappSenders } from '@/lib/data/supabase/communication';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const userRole = (session.user as any).role || 'Admin DP';
    const userDpId = (session.user as any).dropPoint;
    const isSuperAdmin = userRole === 'Super Admin';

    // If Super Admin, fetch all. Otherwise, fetch scoped to DP.
    const dbSenders = await listWhatsappSenders(isSuperAdmin ? undefined : userDpId);
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
        (s.phone && dbSender.phone && (s.phone === dbSender.phone || s.phone === '+' + dbSender.phone)) ||
        (s.id && dbSender.sender_id && String(s.id) === String(dbSender.sender_id)) ||
        (s.sender_code && dbSender.sender_code && s.sender_code === dbSender.sender_code)
      );

      return {
        ...dbSender,
        bablast_live_id: liveData?.id || null,
        // MUST prioritize dbSender.sender_code because Bablast GET /senders API does NOT return sender_code
        sender_code: dbSender.sender_code || liveData?.sender_code || null,
        channel_type: dbSender.channel_type || liveData?.channelType || liveData?.channel_type || null,
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await req.json();
    const { sender_id, phone, display_name, status, sender_code, channel_type } = body;
    const userDpId = (session.user as any).dropPoint;

    if (!phone || !sender_code) {
      return NextResponse.json({ success: false, message: 'Phone and sender_code are required' }, { status: 400 });
    }

    const { upsertWhatsappSenders } = await import('@/lib/data/supabase/communication');
    const result = await upsertWhatsappSenders([{
      sender_id: sender_id || phone,
      phone,
      display_name: display_name || phone,
      status: status || 'connected',
      sender_code,
      channel_type,
      drop_point_id: userDpId || null
    }], session.user.email);

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Sender successfully saved'
    });
  } catch (error: any) {
    console.error('API /communication/whatsapp/senders POST error:', error);
    return errorResponse(error);
  }
}
