/**
 * Utilitas normalisasi dan pencocokan nama Kota/Kabupaten untuk fitur Monitoring INC.
 * Mencegah kesalahan matching substring (misal: "BATANG HARI" tidak boleh terhitung sebagai "BATANG").
 */

/**
 * Menghapus prefix administratif umum (KOTA, KABUPATEN, KAB, KODYA, dll)
 * dan suffix provinsi atau keterangan dalam kurung.
 */
export function normalizeCityName(raw: string): string {
  if (!raw) return '';
  return raw
    .toUpperCase()
    // Hapus keterangan dalam kurung, misal "(KAB)", "(KOTA)", "(JAWA TENGAH)"
    .replace(/\([^)]*\)/g, ' ')
    // Hapus tanda baca umum pemisah kata/keterangan dengan spasi
    .replace(/[\/#!$%^&*;:{}=\_`~]/g, ' ')
    // Hapus suffix provinsi/keterangan setelah koma atau tanda hubung, misal "BATANG, JAWA TENGAH" atau "BATANG - JATENG"
    .replace(/[,–-].*$/g, '')
    .trim()
    // Hapus awalan administratif umum di Indonesia
    .replace(/^(KOTA\s+ADM(INISTRATIF)?|KOTA|KABUPATEN|KAB\.?|KODYA\.?|KOTAMADYA)\s+/i, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Memeriksa apakah nama kota dari input baris JMS cocok dengan target kota.
 * Menggunakan perbandingan exact token yang dinormalisasi, BUKAN includes().
 */
export function isCityMatch(rawInputCity: string, targetCity: string): boolean {
  if (!rawInputCity || !targetCity) return false;

  const rawClean = rawInputCity.trim().toUpperCase();
  const targetClean = targetCity.trim().toUpperCase();

  // 1. Direct exact match
  if (rawClean === targetClean) return true;

  // 2. Normalized exact match (mis. "KOTA BATANG" -> "BATANG" === "BATANG")
  const normInput = normalizeCityName(rawInputCity);
  const normTarget = normalizeCityName(targetCity);

  if (normInput && normTarget && normInput === normTarget) {
    return true;
  }

  return false;
}

/**
 * Menyimpulkan nama Kota/Cabang berdasarkan Drop Point pengguna dan daftar master data Drop Point.
 */
export function resolveCityFromDropPoint(
  dropPointCode?: string | null,
  dropPointsList?: Array<{ 'Kode DP': string; 'Nama Kota'?: string; 'Kode Kota'?: string; 'Wilayah/Cabang'?: string }> | null,
  defaultCity = 'BATANG',
): string {
  if (!dropPointCode) return defaultCity;

  if (dropPointsList && Array.isArray(dropPointsList)) {
    const found = dropPointsList.find((dp) => dp['Kode DP'].toUpperCase() === dropPointCode.toUpperCase());
    if (found) {
      const k = normalizeCityName(found['Nama Kota'] || found['Kode Kota'] || found['Wilayah/Cabang'] || '');
      if (k) return k;
    }
  }

  // Heuristik jika kode DP memuat kata BATANG (mis. BATANG01, BATANG_UTARA)
  if (dropPointCode.toUpperCase().includes('BATANG')) {
    return 'BATANG';
  }

  return defaultCity;
}
