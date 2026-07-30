// Helper MURNI (tanpa DB / tanpa import runtime dari '@/') supaya bisa diuji
// unit langsung dg `node --experimental-strip-types`. longtail-shared.ts
// mengekspor ulang semua ini, jadi import lama dari './longtail-shared' tetap jalan.
import type { LongTailRow } from '@/lib/data/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type LongtailDbRow = {
  no_waybill: string;
  status_terakhir: string | null;
  alasan_bermasalah: string | null;
  dp_sampai: string | null;
  waktu_sampai: string | null;
  umur_frozen: number | null;
  sprinter_delivery: string | null;
  cod: string | null;
  delivery_attempt: number | null;
  feedback: string | null;
  log_feedback: string | null;
  perlu_review: boolean | null;
  version: number;
};

/** Feedback dianggap Clear TTD bila mengandung kata 'TTD'. */
export function isClearTTD(feedback: unknown): boolean {
  return /\bTTD\b/i.test(String(feedback ?? ''));
}

/** Kategori Distribusi Feedback (Bagian 8 PRD). */
export function categorizeFeedback(feedback: unknown): string {
  const f = String(feedback ?? '').trim();
  if (f === '') return 'Belum Feedback';
  if (isClearTTD(f)) return 'Clear TTD';
  const u = f.toUpperCase();
  if (u.includes('ON DELIVERY') || u.includes('ONDELIVERY')) return 'On Delivery';
  if (u.includes('RESCHEDULE')) return 'Reschedule';
  if (u.includes('TIDAK DI TEMPAT') || u.includes('PENERIMA TIDAK')) return 'Penerima Tidak Di Tempat';
  if (u.includes('ALAMAT')) return 'Alamat Tidak Ditemukan';
  return 'Lainnya';
}

/**
 * `waktu_sampai` SELALU merepresentasikan jam dinding Jakarta (WIB/UTC+7),
 * apa pun bentuk stringnya — termasuk kasus di mana ia sudah "ternoda"
 * penanda zona 'Z'/offset yang salah (mis. sel Excel bertipe Date: SheetJS
 * `cellDates:true` mengonversi serial Excel jadi objek Date dengan field UTC
 * SAMA PERSIS dengan angka yang tampil di Excel — bukan dikonversi — lalu
 * `JSON.stringify` menambahkan 'Z' saat dikirim ke server, sehingga jam WIB
 * asli ikut ternoda seolah UTC). Makanya di sini kita SELALU ekstrak
 * angka tanggal/jam mentahnya dan anggap sebagai jam dinding Jakarta,
 * baru dikonversi ke instant UTC yang benar (-7 jam) — TIDAK PERNAH
 * mempercayai zona yang menempel di string maupun timezone server yang
 * menjalankan kode ini.
 */
function parseJakartaInstant(raw: string): number | null {
  const s = raw.trim();
  const dt = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dt) {
    const [, yyyy, mo, dd, hh, mi, ss] = dt;
    const wallUtcMs = Date.UTC(Number(yyyy), Number(mo) - 1, Number(dd), Number(hh), Number(mi), Number(ss ?? '0'));
    return wallUtcMs - 7 * 3600 * 1000;
  }
  const dOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dOnly) {
    const [, yyyy, mo, dd] = dOnly;
    const wallUtcMs = Date.UTC(Number(yyyy), Number(mo) - 1, Number(dd), 0, 0, 0);
    return wallUtcMs - 7 * 3600 * 1000;
  }
  // Format lain di luar dugaan (jarang terjadi) - fallback ke parser bawaan.
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Instant UTC -> tengah malam UTC yg mewakili TANGGAL kalender Jakarta-nya (utk selisih hari kalender, bukan selisih jam). */
function jakartaCalendarDateMs(instantUtcMs: number): number {
  const j = new Date(instantUtcMs + 7 * 3600 * 1000);
  return Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate());
}

/**
 * Umur live dari waktu_sampai: SELISIH TANGGAL KALENDER Jakarta antara hari
 * ini & tanggal waktu_sampai (0 = sampai hari ini, 1 = sampai kemarin, dst) —
 * BUKAN floor(jam berlalu / 24), supaya konsisten dgn semantik agingLevel()
 * (aging-badge.tsx: umur 0 = netral/"baru", 1 = hijau, 2 = kuning, >=3 =
 * merah) dan berjalan live: begitu tanggal Jakarta berganti hari, semua
 * paket aktif otomatis naik 1 angka tanpa perlu proses batch/snapshot apa
 * pun, walau baru beberapa jam berlalu sejak tengah malam.
 * `now` bisa di-inject utk tes.
 */
export function computeUmurLive(waktuSampai: string | null, now: number = Date.now()): number | null {
  const ws = String(waktuSampai ?? '').trim();
  if (!ws) return null;
  const t = parseJakartaInstant(ws);
  if (t == null) return null;
  const diff = Math.round((jakartaCalendarDateMs(now) - jakartaCalendarDateMs(t)) / MS_PER_DAY);
  return diff < 0 ? 0 : diff;
}

/** Umur Paket: beku bila Clear TTD (umur_frozen), selain itu live. '' bila tak tahu. */
export function computeUmur(r: LongtailDbRow): number | '' {
  if (isClearTTD(r.feedback) && r.umur_frozen != null && !isNaN(Number(r.umur_frozen))) {
    return Number(r.umur_frozen);
  }
  const live = computeUmurLive(r.waktu_sampai);
  if (live != null) return live;
  return r.umur_frozen != null ? Number(r.umur_frozen) : '';
}

/** Baris DB -> bentuk lama + field turunan (Umur, __isClearTTD, __version). */
export function decorateLongTailRow(r: LongtailDbRow): LongTailRow {
  return {
    'No. Waybill': String(r.no_waybill ?? ''),
    'Status Terakhir': String(r.status_terakhir ?? ''),
    'Alasan Paket Bermasalah': String(r.alasan_bermasalah ?? ''),
    'DP Sampai': String(r.dp_sampai ?? ''),
    'Waktu Sampai': String(r.waktu_sampai ?? ''),
    'Umur Paket': computeUmur(r),
    'Sprinter Delivery': String(r.sprinter_delivery ?? ''),
    COD: String(r.cod ?? ''),
    'Delivery Attempt': Number(r.delivery_attempt ?? 0),
    Feedback: String(r.feedback ?? ''),
    'Log Feedback': String(r.log_feedback ?? ''),
    'Perlu Review': r.perlu_review ? 'Ya' : '',
    __isClearTTD: isClearTTD(r.feedback),
    __version: String(r.version ?? ''),
  };
}

/** Bagian tanggal 'dd/MM/yy' & jam 'HH:mm:ss' untuk sebuah waktu, di zona Jakarta (UTC+7). */
export function jakartaParts(d: Date): { tanggal: string; jam: string } {
  const j = new Date(d.getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    tanggal: `${p(j.getUTCDate())}/${p(j.getUTCMonth() + 1)}/${String(j.getUTCFullYear()).slice(-2)}`,
    jam: `${p(j.getUTCHours())}:${p(j.getUTCMinutes())}:${p(j.getUTCSeconds())}`,
  };
}

/** Waktu sekarang Jakarta (UTC+7) sebagai bagian tanggal 'dd/MM/yy' & jam 'HH:mm:ss'. */
export function jakartaNowParts(): { tanggal: string; jam: string } {
  return jakartaParts(new Date());
}

/** Tanggal hari ini di Jakarta sebagai ISO 'YYYY-MM-DD' (utk batas query timestamptz). */
export function jakartaTodayIso(): string {
  const j = new Date(Date.now() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())}`;
}

/** Cap waktu 'yyyyMMddHHmmss' Jakarta (utk Batch ID import). */
export function jakartaStamp(): string {
  const j = new Date(Date.now() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}${p(j.getUTCMonth() + 1)}${p(j.getUTCDate())}${p(j.getUTCHours())}${p(j.getUTCMinutes())}${p(j.getUTCSeconds())}`;
}

// ============================================================================
// AUTO-CLOSE (v1.3): waybill yang HILANG dari tarikan import di-close otomatis.
// Menggantikan mekanisme arsip 30-hari lama (PRD Bagian 3).
// ============================================================================

export type AutoCloseTipe = 'Clear TTD' | 'Close Alur';

export type AutoCloseDecision = {
  /** Pembeda di arsip & UI (badge). */
  tipeClose: AutoCloseTipe;
  /** status_terakhir yang disimpan saat diarsipkan. */
  statusTerakhir: string;
  /** Umur beku saat close (Close Alur = umur live saat ini; Clear TTD = umur_frozen apa adanya). */
  umurFrozen: number | null;
  /** Nilai Activity_Log "Data Baru". */
  dataBaru: string;
  /** Nilai Activity_Log "Data Lama" (status sebelum diarsipkan). */
  dataLama: string;
};

/**
 * Tentukan bagaimana sebuah baris (yang hilang dari tarikan) diarsipkan:
 *  - Sudah Clear TTD  -> arsip apa adanya (status & umur tak diubah).
 *  - Selain itu       -> 'CLOSE ALUR', umur di-freeze (sudah tak actionable).
 */
export function decideAutoClose(
  row: Pick<LongtailDbRow, 'feedback' | 'status_terakhir' | 'waktu_sampai' | 'umur_frozen'>,
  now: number = Date.now(),
): AutoCloseDecision {
  const statusLama = String(row.status_terakhir ?? '');
  if (isClearTTD(row.feedback)) {
    return {
      tipeClose: 'Clear TTD',
      statusTerakhir: statusLama,
      umurFrozen: row.umur_frozen ?? null,
      dataBaru: 'Clear TTD',
      dataLama: statusLama,
    };
  }
  return {
    tipeClose: 'Close Alur',
    statusTerakhir: 'CLOSE ALUR',
    umurFrozen: computeUmurLive(row.waktu_sampai, now),
    dataBaru: 'CLOSE ALUR',
    dataLama: statusLama,
  };
}

/**
 * Dari kumpulan baris AKTIF (sudah ter-scope ke DP yang ada di file) + himpunan
 * waybill yang MUNCUL di file (lowercase), hasilkan daftar baris yang harus
 * di-auto-close beserta keputusannya. Baris yang masih muncul di file dilewati.
 */
export function planAutoClose(
  active: LongtailDbRow[],
  presentLower: Set<string>,
  now: number = Date.now(),
): { row: LongtailDbRow; decision: AutoCloseDecision }[] {
  const out: { row: LongtailDbRow; decision: AutoCloseDecision }[] = [];
  for (const r of active) {
    const key = String(r.no_waybill ?? '').trim().toLowerCase();
    if (!key || presentLower.has(key)) continue;
    out.push({ row: r, decision: decideAutoClose(r, now) });
  }
  return out;
}
