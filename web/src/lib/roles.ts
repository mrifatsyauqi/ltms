/**
 * "Full access" = akses SETARA Admin Cabang (Langkah 3 - Perluasan Role):
 * Super Admin, Admin Cabang, Manager Kota, Asisten Manager Kota semuanya
 * IDENTIK - tidak dibatasi per Kota/DP, tidak read-only. Satu-satunya beda
 * di antara Manager Kota/Asisten Manager Kota/Admin Cabang adalah LABEL
 * jabatan, bukan kemampuan sistem (lihat prompt Langkah 3, tabel akses final).
 *
 * Super Admin JUGA dapat bypass eksplisit TERPISAH di requireRole()
 * (data/supabase/helpers.ts, fungsi otorisasi paling dasar) - superior thd
 * array ini, supaya tetap lolos bahkan di pengecekan baru nanti yang lupa
 * memasukkan Super Admin ke daftar rolenya.
 */
export const FULL_ACCESS_ROLES = ['Super Admin', 'Admin Cabang', 'Manager Kota', 'Asisten Manager Kota'] as const;

export function hasFullAccess(role: string | null | undefined): boolean {
  return !!role && (FULL_ACCESS_ROLES as readonly string[]).includes(role);
}
