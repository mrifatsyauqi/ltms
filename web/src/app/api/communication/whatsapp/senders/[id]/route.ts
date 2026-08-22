import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteWhatsappSender } from '@/lib/data/supabase/communication';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
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
