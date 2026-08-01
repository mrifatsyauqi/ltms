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

/**
 * Role yang bisa DI-ASSIGN ke user lewat form Tambah/Edit User (dropdown
 * Jabatan) - SEMUA nilai `users.role` yang valid KECUALI 'Super Admin'.
 * Super Admin sengaja TIDAK BISA dibuat lewat form (cuma lewat SQL manual)
 * - keputusan eksplisit utk mencegah risiko privilege escalation via UI.
 * Dipakai berpasangan: validasi server (users.ts) & opsi dropdown client
 * (user-management-client.tsx) - SATU sumber kebenaran, jangan didup dupe.
 */
export const ASSIGNABLE_ROLES = [
  'Admin Cabang',
  'Manager Kota',
  'Asisten Manager Kota',
  'SPV Drop Point',
  'Admin DP',
] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}
