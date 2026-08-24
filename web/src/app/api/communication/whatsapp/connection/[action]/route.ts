import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { upsertWhatsappSender } from '@/lib/data/supabase/whatsapp';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { action } = await params;
    const body = await req.json().catch(() => ({}));

    if (action === 'pair') {
      const { phone, method } = body;
      if (!phone || !method) {
        return NextResponse.json({ ok: false, error: 'Phone and method are required' }, { status: 400 });
      }
      const data = await bablastService.requestPairing(phone, method);
      
      // Save placeholder connection with connecting status
      await upsertWhatsappSender({
        sender_id: phone,
        display_name: phone,
        status: 'connecting',
        phone: phone,
        created_by: session.user.email,
        last_seen: new Date().toISOString()
      });

      return NextResponse.json({ ok: true, data });
    }

    if (action === 'logout') {
      const { phone } = body;
      if (!phone) {
        return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 400 });
      }
      
      const data = await bablastService.logout(phone);

      // Update to disconnected
      await upsertWhatsappSender({
        sender_id: phone,
        status: 'disconnected',
        last_seen: new Date().toISOString()
      });

      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 404 });
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { action } = await params;
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (action === 'status') {
      if (!phone) {
        return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 400 });
      }

      const data = await bablastService.getSenderStatus(phone);
      
      // Map bablast status to our DB status
      let mappedStatus = 'disconnected';
      const actualStatus = data?.data?.status;
      const isConnected = data?.data?.isConnected;
      
      if (isConnected === true || actualStatus === 'connected' || actualStatus === 'open') {
        mappedStatus = 'connected';
      } else if (actualStatus === 'connecting' || actualStatus === 'pending' || actualStatus === 'pending_config' || actualStatus === 'close') {
        mappedStatus = 'connecting';
      }
      
      // Update DB with latest status
      if (mappedStatus === 'connected' || mappedStatus === 'disconnected') {
        await upsertWhatsappSender({
          sender_id: phone,
          status: mappedStatus,
          last_seen: new Date().toISOString()
        });
      }

      return NextResponse.json({ ok: true, data, mappedStatus });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 404 });
  } catch (error: any) {
    return errorResponse(error);
  }
}
