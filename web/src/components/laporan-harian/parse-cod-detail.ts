import type { CodTableTotals, SprinterCodRow } from './types';

/** Satu baris file tarikan JMS Detail (per-AWB) - kolom dibaca lewat NAMA
 *  header (bukan posisi), sama seperti pola Monitoring INC (bukan format
 *  "Total" Monitoring Delivery yang sudah teragregasi & dibaca posisional -
 *  lihat audit di laporan-harian-client.tsx). */
export interface CodDetailRawRow {
  sprinterDelivery: string;
  /** blank = paket ini BELUM TTD (formula asli: 'DATA COPAS'!K:K, "DP TTD"). */
  dpTtd: unknown;
  /** dipakai formula Nominal Sisa COD (kolom "Sprinter Delivery TTD") -
   *  BUKAN selalu sama dgn sprinterDelivery (lihat catatan di bawah). */
  sprinterDeliveryTtd: unknown;
  cod: number;
  /** kolom "TTD Retur" - baris hanya "diambil" (lihat passesRowFilter) bila
   *  nilainya persis 0 (paket tidak retur). */
  ttdRetur: unknown;
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

/**
 * Baris "diambil" utk tabel Rincian Nominal COD Kurir (dipakai membangun
 * daftar sprinter & hitung Total Pengiriman/Semua Nominal COD per sprinter) -
 * REVISI: sebelumnya nama sprinter & pengelompokan baris memakai kolom
 * "Sprinter Delivery", sekarang memakai "Sprinter Delivery TTD" (siapa yg
 * BENAR2 TTD paket ini, bukan siapa yg ditugaskan mengantar). Ketiga syarat
 * berikut WAJIB terpenuhi sekaligus per baris:
 *  1. "Sprinter Delivery TTD" berkode MTR di depan (mis. "Mtr Budi").
 *  2. "TTD Retur" = 0 (paket tidak retur).
 *  3. "COD" != 0 (hanya paket ber-COD).
 * CATATAN: formula "Nominal Sisa COD" (codViaSprinterTtd, di computeCodTable
 * bawah) SENGAJA TIDAK ikut direvisi - tetap dihitung dari SELURUH baris
 * mentah (parameter `rows`, bukan hasil filter ini), persis seperti semula.
 */
function passesRowFilter(r: CodDetailRawRow): boolean {
  const name = String(r.sprinterDeliveryTtd ?? '').trim();
  if (!name.toLowerCase().startsWith('mtr')) return false;
  // Number('') === 0 (quirk JS) - blank BUKAN "bernilai 0", jadi dicek eksplisit
  // via isBlank dulu supaya sel kosong tidak lolos sebagai "TTD Retur = 0".
  if (isBlank(r.ttdRetur) || Number(r.ttdRetur) !== 0) return false;
  if (!r.cod) return false; // cod !== 0 (r.cod bertipe number, 0 falsy)
  return true;
}

/**
 * Hitung tabel Rincian Nominal COD Kurir per Sprinter - REPLIKASI PERSIS
 * formula sheet HASIL (LAPORAN_HARIAN_BGG16.xlsx), diverifikasi cocok
 * 100% (per-baris + baris TOTAL) terhadap sheet DATA COPAS via simulasi
 * Python sebelum kode ini ditulis. JANGAN ubah formula di bawah tanpa
 * verifikasi ulang terhadap file target.
 *
 * Catatan formula "Nominal Sisa COD": dihitung sbg (Semua Nominal COD)
 * dikurangi SUM(COD dari baris yang kolom "Sprinter Delivery TTD"-nya
 * sama dgn nama sprinter ini) - BUKAN langsung sum COD dari baris yang
 * "DP TTD"-nya kosong. Keduanya biasanya identik (sprinter yang
 * mengantar = sprinter yang TTD), tapi kalau suatu paket di-TTD oleh
 * sprinter LAIN dari yang tertulis di "Sprinter Delivery", angkanya bisa
 * sedikit meleset utk KEDUA sprinter itu - ini quirk formula ASLI
 * (bukan bug di sini), direplikasi apa adanya sesuai instruksi.
 *
 * Sprinter dgn total "Semua Nominal COD" = 0 DIKECUALIKAN dari hasil
 * (sprinter yang tak pernah pegang paket COD tak perlu muncul).
 */
export function computeCodTable(rows: CodDetailRawRow[]): { rows: SprinterCodRow[]; totals: CodTableTotals } {
  // Baris yg "diambil" utk tabel ini - lihat passesRowFilter di atas.
  const filteredRows = rows.filter(passesRowFilter);

  const sprinterNames = new Set<string>();
  for (const r of filteredRows) {
    sprinterNames.add(String(r.sprinterDeliveryTtd ?? '').trim());
  }

  const sorted = [...sprinterNames].sort((a, b) => a.localeCompare(b, 'id'));

  const result: SprinterCodRow[] = [];
  for (const name of sorted) {
    const matched = filteredRows.filter((r) => String(r.sprinterDeliveryTtd ?? '').trim() === name);
    const semuaDeliv = matched.length;
    const semuaNominalCod = matched.reduce((sum, r) => sum + (r.cod || 0), 0);

    // Safety net (harusnya tak pernah kejadian): passesRowFilter mewajibkan
    // cod!=0 per baris, jadi semuaNominalCod cuma bisa 0 kalau `matched` kosong.
    if (semuaNominalCod === 0) continue;

    const resiSisaNonCod = matched.filter((r) => isBlank(r.dpTtd) && (r.cod || 0) <= 0).length;
    const resiSisaCod = matched.filter((r) => isBlank(r.dpTtd) && (r.cod || 0) > 0).length;

    // SUM COD dari SELURUH baris (bukan cuma yang matched E) yang kolom
    // "Sprinter Delivery TTD" == nama sprinter ini - lihat catatan formula.
    const codViaSprinterTtd = rows.reduce(
      (sum, r) => sum + (String(r.sprinterDeliveryTtd ?? '').trim() === name ? r.cod || 0 : 0),
      0
    );
    const nominalSisaCod = semuaNominalCod - codViaSprinterTtd;

    const totalResiSisa = resiSisaNonCod + resiSisaCod;
    const suksesTtd = semuaDeliv - totalResiSisa;
    const pctClearPaket = semuaDeliv > 0 ? suksesTtd / semuaDeliv : 0;
    const pctClearNominalCod = semuaNominalCod !== 0 ? (semuaNominalCod - nominalSisaCod) / semuaNominalCod : null;
    const pctSelisih = pctClearNominalCod !== null ? pctClearPaket - pctClearNominalCod : null;

    result.push({
      idSprinter: name,
      semuaDeliv,
      semuaNominalCod,
      resiSisaNonCod,
      resiSisaCod,
      nominalSisaCod,
      pctClearPaket,
      pctClearNominalCod,
      pctSelisih,
      suksesTtd,
      pctTtd: pctClearPaket,
    });
  }

  const totals: CodTableTotals = result.reduce<CodTableTotals>(
    (acc, r) => ({
      semuaDeliv: acc.semuaDeliv + r.semuaDeliv,
      semuaNominalCod: acc.semuaNominalCod + r.semuaNominalCod,
      resiSisaNonCod: acc.resiSisaNonCod + r.resiSisaNonCod,
      resiSisaCod: acc.resiSisaCod + r.resiSisaCod,
      nominalSisaCod: acc.nominalSisaCod + r.nominalSisaCod,
      suksesTtd: acc.suksesTtd + r.suksesTtd,
      // % di baris TOTAL dihitung ULANG dari agregat, bukan rata-rata per
      // baris (sama seperti target: R56 = Q56/I56, bukan AVERAGE(R5:R55)).
      pctClearPaket: 0,
      pctClearNominalCod: 0,
      pctSelisih: 0,
      pctTtd: 0,
    }),
    {
      semuaDeliv: 0,
      semuaNominalCod: 0,
      resiSisaNonCod: 0,
      resiSisaCod: 0,
      nominalSisaCod: 0,
      suksesTtd: 0,
      pctClearPaket: 0,
      pctClearNominalCod: 0,
      pctSelisih: 0,
      pctTtd: 0,
    }
  );
  totals.pctClearPaket = totals.semuaDeliv > 0 ? totals.suksesTtd / totals.semuaDeliv : 0;
  totals.pctClearNominalCod =
    totals.semuaNominalCod !== 0 ? (totals.semuaNominalCod - totals.nominalSisaCod) / totals.semuaNominalCod : null;
  totals.pctSelisih = totals.pctClearNominalCod !== null ? totals.pctClearPaket - totals.pctClearNominalCod : null;
  totals.pctTtd = totals.pctClearPaket;

  return { rows: result, totals };
}

/** Baca file Excel tarikan JMS Detail (SheetJS sudah di-parse jadi array of
 *  Record) - cari kolom lewat NAMA header, toleran spasi/kapitalisasi,
 *  sama seperti getCol() di monitoring-inc-client.tsx. */
export function extractCodDetailRows(rawData: Record<string, unknown>[]): CodDetailRawRow[] {
  const out: CodDetailRawRow[] = [];
  for (const row of rawData) {
    const getCol = (...keys: string[]) => {
      for (const k of keys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
            return row[rowKey];
          }
        }
      }
      return undefined;
    };

    const sprinterDelivery = String(getCol('Sprinter Delivery') || '').trim();
    if (!sprinterDelivery) continue;

    const codRaw = getCol('COD');
    const cod =
      typeof codRaw === 'number'
        ? codRaw
        : parseFloat(String(codRaw ?? '').replace(/[^\d.-]/g, '')) || 0;

    out.push({
      sprinterDelivery,
      dpTtd: getCol('DP TTD'),
      sprinterDeliveryTtd: getCol('Sprinter Delivery TTD'),
      cod,
      ttdRetur: getCol('TTD Retur'),
    });
  }
  return out;
}
