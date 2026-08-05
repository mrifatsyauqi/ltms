import { NextResponse } from 'next/server';
import { groupService } from '@/services/communication/configuration/group.service';

export async function POST() {
  try {
    const groups = await groupService.syncFromFeishu();
    return NextResponse.json({ success: true, ok: true, data: groups });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message || 'Gagal menyinkronkan group dari Feishu' },
      { status: 500 }
    );
  }
}
