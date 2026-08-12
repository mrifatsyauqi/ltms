import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadImportBatchFiles } from '@/lib/data/import';
import { errorResponse, unauthenticated } from '@/lib/api-response';

/** Upload file ASLI Import Long Tail (retensi 7 hari) - dipanggil TERPISAH
 *  setelah /api/import sukses, dari FormData (bukan JSON) karena mengirim
 *  byte file, bukan baris hasil parse. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const form = await request.formData();
  const batchId = String(form.get('batchId') ?? '');
  const fileEntries = form.getAll('files').filter((f): f is File => f instanceof File);

  const files = await Promise.all(
    fileEntries.map(async (f) => ({
      name: f.name,
      bytes: new Uint8Array(await f.arrayBuffer()),
      sizeBytes: f.size,
    })),
  );

  try {
    const data = await uploadImportBatchFiles(session.user.email, batchId, files);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
