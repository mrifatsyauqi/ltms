import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteWhatsappSender, getWhatsappSenderById } from '@/lib/data/supabase/communication';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    
    // 1. Fetch sender first to get the phone/sender_id and status
    const sender = await getWhatsappSenderById(id);
    
    if (sender && sender.status === 'connected') {
      try {
        // Log out the connector from Bablast before deleting
        await bablastService.logout(sender.sender_id || sender.phone || undefined);
      } catch (err: any) {
        console.error('Failed to logout sender from Bablast before deleting:', err.message);
        return NextResponse.json({ 
          success: false, 
          message: 'LTMS gagal memutus koneksi WhatsApp. Sender belum dihapus.',
          error: err.message
        }, { status: 500 });
      }
    }

    // 2. Delete the record from LTMS database
    const success = await deleteWhatsappSender(id);
    if (!success) {
      return NextResponse.json({ success: false, message: 'Failed to delete sender' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Sender deleted successfully' });
  } catch (error: any) {
    console.error('API /communication/whatsapp/senders/[id] delete error:', error);
    return errorResponse(error);
  }
}
