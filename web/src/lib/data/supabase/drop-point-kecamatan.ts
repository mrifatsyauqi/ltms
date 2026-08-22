import { db } from './client';
import { ApiError } from '@/lib/errors';
import { normalizeKecamatan } from '@/lib/kecamatan';

export type DpKecamatanMatch = { kodeDp: string; namaDp: string };

/**
 * Satu-satunya titik pencocokan Kecamatan -> Kode DP di seluruh sistem
 * (tabel `drop_point_kecamatan`, diisi dari Master Drop Point). Fitur apa
 * pun yang perlu tahu "Kecamatan tujuan X ditangani DP mana" (Monitoring
 * INC, dan fitur lain di masa depan) WAJIB memanggil ini - JANGAN duplikasi
 * logic pencocokan Kecamatan per-fitur.
 *
 * Logika bisnis Long Tail (import, dedup, freeze aging, Dashboard, Feedback
 * Long Tail) TIDAK memakai helper ini - tetap mencocokkan via Nama DP
 * (`DP Sampai`) seperti sekarang, tidak berubah sama sekali.
 */
export async function findDpByKecamatanBatch(
  kecamatanListRaw: string[],
): Promise<Map<string, DpKecamatanMatch>> {
  const result = new Map<string, DpKecamatanMatch>();
  const normalized = [...new Set(kecamatanListRaw.map((k) => normalizeKecamatan(String(k))).filter(Boolean))];
  if (normalized.length === 0) return result;

  const { data: kecRows, error: kecErr } = await db()
    .from('drop_point_kecamatan')
    .select('kecamatan, kode_dp')
    .in('kecamatan', normalized);
  if (kecErr) throw new ApiError('INTERNAL_ERROR', kecErr.message);
  if (!kecRows || kecRows.length === 0) return result;

  const kodeDpList = [...new Set(kecRows.map((r) => String(r.kode_dp)))];
  const { data: dpRows, error: dpErr } = await db()
    .from('master_drop_point')
    .select('kode_dp, nama_dp')
    .in('kode_dp', kodeDpList);
  if (dpErr) throw new ApiError('INTERNAL_ERROR', dpErr.message);
  const namaByKode = new Map((dpRows ?? []).map((r) => [String(r.kode_dp), String(r.nama_dp)]));

  for (const row of kecRows) {
    const kodeDp = String(row.kode_dp);
    result.set(String(row.kecamatan), { kodeDp, namaDp: namaByKode.get(kodeDp) ?? kodeDp });
  }
  return result;
}

export async function findDpByKecamatan(kecamatan: string): Promise<DpKecamatanMatch | null> {
  const map = await findDpByKecamatanBatch([kecamatan]);
  return map.get(normalizeKecamatan(kecamatan)) ?? null;
}
