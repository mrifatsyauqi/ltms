/**
 * Utilitas normalisasi dan pencocokan nama kota untuk tarikan data JMS & Drop Point.
 */

export function normalizeCityName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/\b(KOTA|KABUPATEN|KAB\.?|DISTRICT)\b/gi, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Memeriksa apakah nama kota dari tarikan JMS cocok dengan target kota yang dipilih.
 * Menggunakan pencocokan token untuk mencegah false-positive (misal "BATANG" tidak boleh mencocokkan "BATANG HARI").
 */
export function isCityMatch(rawCity: string | null | undefined, targetCity: string): boolean {
  if (!rawCity || !targetCity) return false;

  const cleanRaw = normalizeCityName(rawCity);
  const cleanTarget = normalizeCityName(targetCity);

  if (!cleanRaw || !cleanTarget) return false;
  if (cleanRaw === cleanTarget) return true;

  // Exact word boundary matching: targetCity harus muncul sebagai kata utuh
  // dan jika target adalah single word seperti "BATANG", string tidak boleh memiliki nama wilayah berbeda (seperti "BATANG HARI")
  const targetWords = cleanTarget.split(/\s+/).filter(Boolean);
  const rawWords = cleanRaw.split(/\s+/).filter(Boolean);

  if (targetWords.length === 1) {
    const singleTarget = targetWords[0];
    // Jika raw cuma 1 kata dan sama
    if (rawWords.length === 1 && rawWords[0] === singleTarget) return true;

    // Jika raw punya kata 'BATANG', pastikan kata berikutnya bukan qualifier kota lain seperti 'HARI', 'KUIS', 'TARANG'
    const index = rawWords.indexOf(singleTarget);
    if (index !== -1) {
      // Periksa apakah ini kota khusus dengan nama majemuk
      const nextWord = rawWords[index + 1];
      const excludedNextWords = ['HARI', 'KUIS', 'TARANG', 'ANAI', 'KAPAS'];
      if (nextWord && excludedNextWords.includes(nextWord)) {
        return false;
      }
      return true;
    }
  }

  // Jika target kata majemuk (misal "BATANG HARI"), bandingkan apakah raw memuat urutan kata tersebut
  const targetPhrase = targetWords.join(' ');
  return cleanRaw.includes(targetPhrase);
}

/**
 * Mendapatkan nama kota acuan dari kode Drop Point (misal: "DP BATANG01" -> "BATANG").
 */
export function resolveCityFromDropPoint(dropPoint: string | null | undefined): string | null {
  if (!dropPoint) return null;
  const clean = dropPoint.toUpperCase().replace(/\bDP\b/gi, '').replace(/\d+$/, '').trim();
  const normalized = normalizeCityName(clean);
  return normalized || null;
}
