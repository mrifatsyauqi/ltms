import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { downloadImportBatchFile } from '@/lib/data/import';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { id } = await params;
  try {
    const { namaFile, blob } = await downloadImportBatchFile(session.user.email, id);
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(namaFile)}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
