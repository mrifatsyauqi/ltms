import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeDailySnapshot } from '@/lib/data/dashboard';
import { cleanupExpiredImportFiles } from '@/lib/data/import';
import { hasFullAccess } from '@/lib/roles';

/**
 * Rekam snapshot Dashboard harian (v1.3). Dipanggil:
 *  - Vercel Cron (harian) — mengirim header `Authorization: Bearer $CRON_SECRET`.
 *  - Manual oleh Admin Cabang (sesi login) — utk seed hari ini / uji.
 *
 * Sekaligus membersihkan file asli Import Long Tail yang sudah lewat retensi
 * 7 hari (lihat cleanupExpiredImportFiles) — DIGABUNG ke cron harian yang
 * sudah ada ini (bukan entri cron terpisah di vercel.json) supaya tak
 * menambah jumlah cron job.
 */
async function run() {
  try {
    const data = await writeDailySnapshot();
    try {
      await cleanupExpiredImportFiles();
    } catch (err) {
      console.error('cron/snapshot: cleanupExpiredImportFiles gagal', (err as Error).message);
    }
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;
  const session = await auth();
  return hasFullAccess(session?.user?.role);
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return run();
}

// Tombol manual "Ambil snapshot sekarang" (Admin Cabang) memakai POST.
export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return run();
}
