import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getWhatsappContacts, upsertWhatsappContact } from '@/lib/data/supabase/whatsapp';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dpIds = searchParams.getAll('dp');
    const contacts = await getWhatsappContacts(dpIds.length > 0 ? dpIds : undefined);
    
    return NextResponse.json({ ok: true, data: contacts });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { sprinter_id, name, phone_number, drop_point_id } = body;
    if (!sprinter_id || !name || !phone_number || !drop_point_id) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const contact = await upsertWhatsappContact({
      sprinter_id,
      name,
      phone_number,
      drop_point_id,
      status: 'active'
    });
    
    return NextResponse.json({ ok: true, data: contact });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
