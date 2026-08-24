import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveTemplate, createTemplate } from '@/lib/data/supabase/whatsapp';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const template = await getActiveTemplate();
    return NextResponse.json({ ok: true, data: template });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.content) {
      return NextResponse.json({ ok: false, error: 'Content is required' }, { status: 400 });
    }

    const template = await createTemplate({
      name: body.name || 'Custom Push Mas Kurir',
      content: body.content,
      status: 'active',
      created_by: session.user.email || 'unknown',
    });
    
    return NextResponse.json({ ok: true, data: template });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
