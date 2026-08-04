/**
 * Utilitas untuk parsing dan pemformatan tanggal waktu dari file Excel / JMS.
 * Mendukung Excel Serial Date Numbers (mis. 46237.36094907407), Date object, ISO string, dan DMY string.
 */

export interface ParsedDateTime {
  date: Date;
  formatted: string; // 'YYYY-MM-DD HH:mm:ss'
  timeOnly: string; // 'HH:mm:ss'
}

export function parseExcelDate(raw: unknown): ParsedDateTime | null {
  if (raw === null || raw === undefined) return null;

  // Cek apakah string tidak valid seperti "Belum TTD", "-", "N/A", dll.
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '-' || /^(belum|n\/a|null|undefined|tidak ada)/i.test(trimmed)) {
      return null;
    }
  }

  let dateObj: Date | null = null;

  // 1. Cek apakah ini Excel Serial Number (misal: 46237.36094907407 atau 46236)
  const num =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && !isNaN(Number(raw)) && Number(raw) > 1000
      ? Number(raw)
      : null;

  if (num !== null) {
    // 25569 = hari antara 1899-12-30 dan 1970-01-01 UTC
    const excelEpochMs = (num - 25569) * 86400 * 1000;
    const tempDate = new Date(excelEpochMs);

    // Hitung jam, menit, detik presisi dari sisa hari
    const totalSeconds = Math.round(num * 86400);
    const daySeconds = ((totalSeconds % 86400) + 86400) % 86400;
    const hours = Math.floor(daySeconds / 3600);
    const minutes = Math.floor((daySeconds % 3600) / 60);
    const seconds = daySeconds % 60;

    const year = tempDate.getUTCFullYear();
    const month = tempDate.getUTCMonth();
    const day = tempDate.getUTCDate();

    dateObj = new Date(year, month, day, hours, minutes, seconds);
  } else if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      dateObj = raw;
    }
  } else if (typeof raw === 'string') {
    const str = raw.trim();

    // Format YYYY-MM-DD HH:mm:ss atau YYYY/MM/DD HH:mm:ss
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+[Tt]?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    // Format DD-MM-YYYY HH:mm:ss atau DD/MM/YYYY HH:mm:ss
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+[Tt]?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);

    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const hours = parseInt(isoMatch[4] || '0', 10);
      const minutes = parseInt(isoMatch[5] || '0', 10);
      const seconds = parseInt(isoMatch[6] || '0', 10);
      dateObj = new Date(year, month, day, hours, minutes, seconds);
    } else if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const hours = parseInt(dmyMatch[4] || '0', 10);
      const minutes = parseInt(dmyMatch[5] || '0', 10);
      const seconds = parseInt(dmyMatch[6] || '0', 10);
      dateObj = new Date(year, month, day, hours, minutes, seconds);
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return null;
  }

  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');

  return {
    date: dateObj,
    formatted: `${y}-${m}-${d} ${hh}:${mm}:${ss}`,
    timeOnly: `${hh}:${mm}:${ss}`,
  };
}

/**
 * Format tanggal untuk tampilan UI (DD MMM YYYY HH:mm).
 */
export function formatDisplayDateTime(d: Date = new Date()): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}
