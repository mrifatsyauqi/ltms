import { db } from './client';
import { ApiError } from '@/lib/errors';
import { hasFullAccess } from '@/lib/roles';

export type Actor = {
  /** users.id (uuid) - dipakai SPV Drop Point utk resolve DP yang disupervisi. */
  id: string;
  email: string;
  role: string;
  dropPoint: string;
  /** NIK login (migrasi auth Google->NIK); '' kalau belum diisi (user lama). */
  nik: string;
  /** Nama utk atribusi Activity_Log: akun individual = nama orang, akun
   *  general = "DP <KODE_DP>" (lihat attributionName di bawah). */
  namaTampilan: string;
  tipeAkun: 'individual' | 'general';
};

/**
 * Resolusi + validasi aktor dari tabel users (ganti requireActor_ Apps Script).
 * Identitas pasca-login SELALU email (primary key users, termasuk akun
 * General yang punya email placeholder) — NIK hanya dipakai saat LOGIN untuk
 * mencari baris user (lihat findUserRowByIdentifier di supabase/auth.ts),
 * bukan di sini. Email disimpan & dibandingkan lowercase. Menolak user yang
 * tidak ada atau nonaktif.
 */
export async function requireActor(email: string | null | undefined): Promise<Actor> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) throw new ApiError('UNAUTHENTICATED', 'Email kosong');
  const { data, error } = await db()
    .from('users')
    .select('id, email, nik, nama, nama_tampilan, tipe_akun, role, drop_point, status_aktif')
    .eq('email', e)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data || data.status_aktif !== true) {
    throw new ApiError('UNAUTHENTICATED', `User "${e}" tidak dikenali atau nonaktif di tabel users Supabase`);
  }
  return {
    id: String(data.id ?? ''),
    email: String(data.email),
    role: String(data.role),
    dropPoint: String(data.drop_point ?? ''),
    nik: String(data.nik ?? ''),
    namaTampilan: String(data.nama_tampilan ?? data.nama ?? ''),
    tipeAkun: data.tipe_akun === 'general' ? 'general' : 'individual',
  };
}

/**
 * Nama yang ditulis ke Activity_Log/Log Feedback (kolom "Admin"). Akun
 * General -> nama_tampilan ("DP <KODE_DP>"), BUKAN email placeholder-nya.
 * Akun individual -> tetap email seperti sebelumnya (tidak mengubah histori
 * yang sudah ada).
 */
export function attributionName(actor: Actor): string {
  return actor.tipeAkun === 'general' ? actor.namaTampilan : actor.email;
}

/**
 * Super Admin bypass eksplisit di FUNGSI OTORISASI PALING DASAR (dicek SEBELUM
 * array `roles` sama sekali) - superior thd pengecekan role apapun, termasuk
 * yang ditambahkan nanti dan lupa memasukkan 'Super Admin' ke daftarnya.
 * JANGAN pindahkan Super Admin jadi anggota biasa di FULL_ACCESS_ROLES saja -
 * itu tidak memberi jaminan yang sama (lihat lib/roles.ts).
 */
export function requireRole(actor: Actor, roles: readonly string[]): Actor {
  if (actor.role === 'Super Admin') return actor;
  if (!roles.includes(actor.role)) {
    throw new ApiError('FORBIDDEN', `Role ${actor.role} tidak diizinkan untuk aksi ini`);
  }
  return actor;
}

/** Boolean DB -> teks 'Aktif'/'Nonaktif' seperti bentuk lama sheet. */
export function aktifText(v: unknown): string {
  return v ? 'Aktif' : 'Nonaktif';
}

/** Pastikan Drop Point ada & aktif (ganti assertDropPointActive_ Apps Script). */
export async function assertDropPointActive(kodeDp: string): Promise<void> {
  const kode = String(kodeDp ?? '').trim();
  const { data, error } = await db()
    .from('master_drop_point')
    .select('status_aktif')
    .eq('kode_dp', kode)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('VALIDATION_ERROR', `Drop Point "${kode}" tidak ditemukan`);
  if (data.status_aktif !== true) throw new ApiError('VALIDATION_ERROR', `Drop Point "${kode}" tidak aktif`);
}

/** Pastikan users.id yang dipilih (Manager Kota/Asisten Manager/SPV Drop
 *  Point - label organisasi, lihat cabang.ts) benar-benar ada. */
export async function assertUserExists(userId: string): Promise<void> {
  const { data, error } = await db().from('users').select('id').eq('id', userId).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('VALIDATION_ERROR', 'Akun yang dipilih tidak ditemukan');
}

/** Pastikan Kota (cabang.kode_kota) ada, dipakai saat assign Drop Point ke Kota. */
export async function assertKotaExists(kodeKota: string): Promise<void> {
  const { data, error } = await db().from('cabang').select('kode_kota').eq('kode_kota', kodeKota).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('VALIDATION_ERROR', `Kota "${kodeKota}" tidak ditemukan`);
}

/**
 * jabatan.id yang `nama`-nya persis sama dengan `role` - mapping otomatis
 * role->jabatan selama masa transisi (migrasi Jabatan). `role` TETAP sumber
 * kebenaran utk akses (tidak diubah task ini); `jabatan_id` cuma disinkronkan
 * mengikuti role setiap kali akun dibuat/role-nya berubah, supaya tak pernah
 * ada akun dengan jabatan_id kosong/menyimpang dari role-nya. Lihat
 * supabase/jabatan_migration.sql.
 */
export async function resolveJabatanIdByRole(role: string): Promise<string> {
  const { data, error } = await db().from('jabatan').select('id').eq('nama', role).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('INTERNAL_ERROR', `Jabatan untuk role "${role}" tidak ditemukan di tabel jabatan`);
  return String(data.id);
}

/** Kode DP yang disupervisi SPV Drop Point (master_drop_point.spv_drop_point_user_id
 *  = users.id) - bisa lebih dari satu, BEDA dari Admin DP yang selalu 1 (users.drop_point). */
export async function getSupervisedDPs(actorId: string): Promise<string[]> {
  const { data, error } = await db().from('master_drop_point').select('kode_dp').eq('spv_drop_point_user_id', actorId);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((r) => String((r as { kode_dp: string }).kode_dp));
}

/**
 * Daftar kode_dp yang boleh diakses actor. `null` = TANPA batasan (full
 * access - Super Admin/Admin Cabang/Manager Kota/Asisten Manager Kota).
 * SPV Drop Point: array 0/1/banyak DP (getSupervisedDPs). Admin DP: array
 * berisi 1 elemen (actor.dropPoint), perilaku sama seperti sebelum Langkah 3.
 *
 * SENGAJA TETAP kode_dp murni (BUKAN diekspansi ke Nama DP di sini) - dipakai
 * beberapa caller utk CARDINALITY (mis. getDashboardSnapshot: "actor ini
 * disupervisi TEPAT 1 DP?"), bukan cuma keanggotaan. Utk memfilter/mencocokkan
 * kolom dp_sampai/activity_log.dp, panggil expandDpMatchValues() TERPISAH di
 * titik query-nya - lihat komentar fungsi itu.
 */
export async function resolveScopedDps(actor: Actor): Promise<string[] | null> {
  if (hasFullAccess(actor.role)) return null;
  if (actor.role === 'SPV Drop Point') return getSupervisedDPs(actor.id);
  return actor.dropPoint ? [actor.dropPoint] : [];
}

/**
 * Nilai dp_sampai/activity_log.dp yang SAH utk satu/lebih Kode DP - termasuk
 * Nama DP-nya juga, BUKAN cuma Kode DP. Konvensi "Kode DP harus sama persis
 * dgn 'DP Sampai' di data JMS" (lihat master/drop-point-client.tsx) TERNYATA
 * tidak selalu diikuti saat Kode DP dibuat - beberapa DP (mis. WARUNGASEM,
 * BLADO01, GRINGSING_LAMA, BANDAR01) punya Kode DP master yang BEDA dari teks
 * "DP Sampai" asli yang sudah terlanjur ter-import ke tabel longtail.
 * Tanpa ekspansi ini, SEMUA filter/otorisasi berbasis dp_sampai (Dashboard,
 * Feedback Long Tail, Riwayat Feedback, assertCanAccessDp) menghasilkan 0
 * baris / FORBIDDEN utk DP-DP itu meskipun datanya ADA (ditemukan dari bug
 * report: filter Cakupan ke DP tsb -> Dashboard kosong total, padahal
 * "Progress per Drop Point" versi tak difilter menunjukkan datanya ada).
 * Nilai input tetap disertakan sbg fallback (DP yang tak ada di master tetap
 * cocok ke dirinya sendiri, bukan malah 0 hasil).
 */
export async function expandDpMatchValues(kodeDpList: string[]): Promise<string[]> {
  const list = kodeDpList.filter(Boolean);
  if (list.length === 0) return [];
  const { data, error } = await db().from('master_drop_point').select('kode_dp, nama_dp').in('kode_dp', list);
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  const out = new Set<string>(list);
  for (const row of (data ?? []) as { kode_dp: string; nama_dp: string }[]) {
    if (row.kode_dp) out.add(row.kode_dp);
    if (row.nama_dp) out.add(row.nama_dp);
  }
  return [...out];
}
