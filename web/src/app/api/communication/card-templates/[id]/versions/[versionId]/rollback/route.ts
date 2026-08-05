import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';

/**
 * POST /api/communication/card-templates/[id]/versions/[versionId]/rollback
 * SEBELUMNYA dipanggil client tapi TIDAK PERNAH ada implementasinya - tombol
 * "Rollback" di modal Riwayat Versi selalu gagal diam-diam. Sekarang benar2
 * mengembalikan blocks_config template ke isi versi lama (dicatat sbg versi
 * baru, riwayat tak pernah dihapus).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id, versionId } = await params;
    const data = await cardTemplateService.rollbackToVersion(id, versionId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
