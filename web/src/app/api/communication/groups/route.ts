import { NextRequest, NextResponse } from 'next/server';
import { groupService } from '@/services/communication/configuration/group.service';

export async function GET() {
  try {
    const groups = await groupService.listGroups();
    return NextResponse.json({ ok: true, data: groups });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal memuat daftar group' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const groups = await groupService.syncFromFeishu();
    return NextResponse.json({ ok: true, data: groups });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal menyinkronkan group dari Feishu' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, isDefault, status } = body;

    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'chatId wajib diisi' }, { status: 400 });
    }

    if (isDefault) {
      const ok = await groupService.setDefault(chatId);
      return NextResponse.json({ ok });
    }

    if (status) {
      const ok = await groupService.toggleStatus(chatId, status);
      return NextResponse.json({ ok });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal memperbarui konfigurasi group' },
      { status: 500 }
    );
  }
}
