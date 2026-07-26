import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeDailySnapshot } from '@/lib/data/dashboard';
import { USE_SUPABASE } from '@/lib/data/backend';

/**
 * Rekam snapshot Dashboard harian (v1.3). Dipanggil:
 *  - Vercel Cron (harian) — mengirim header `Authorization: Bearer $CRON_SECRET`.
 *  - Manual oleh Admin Cabang (sesi login) — utk seed hari ini / uji.
 */
async function run() {
  if (!USE_SUPABASE) {
    return NextResponse.json({ ok: false, error: 'Snapshot hanya untuk backend Supabase' }, { status: 400 });
  }
  try {
    const data = await writeDailySnapshot();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;
  const session = await auth();
  return session?.user?.role === 'Admin Cabang';
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
