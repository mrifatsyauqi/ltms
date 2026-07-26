/**
 * Flag pemilih backend data. `DATA_BACKEND=supabase` -> pakai Supabase;
 * selain itu (kosong/'sheets') -> tetap Google Sheets (Apps Script).
 * Dibaca server-side saja. Cutover & rollback cukup lewat env var ini.
 */
export const USE_SUPABASE = process.env.DATA_BACKEND === 'supabase';
