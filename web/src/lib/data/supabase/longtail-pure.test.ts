// Unit test PERSISTEN utk logika inti LongTail yang murni (tanpa DB), memakai
// test runner bawaan Node (`node:test`) + strip-types (lihat header
// longtail-pure.ts). Jalankan: `npm test` (script di package.json).
//
// Mengisi kekosongan yang ditemukan saat audit: klaim commit lama menyebut
// "unit test auto-close 4/4" tapi TIDAK ADA file test tersisa di repo, jadi
// regresi tak bisa dideteksi otomatis. File ini menguji fungsi PRODUKSI yang
// asli (bukan replika) untuk: Auto-Close (decideAutoClose/planAutoClose) &
// Freeze/Resume Umur (computeUmur/computeUmurLive).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeUmur,
  computeUmurLive,
  decideAutoClose,
  planAutoClose,
  isClearTTD,
  type LongtailDbRow,
} from './longtail-pure.ts';

/** Baris LongTail lengkap dgn default wajar; override lewat argumen. */
function row(over: Partial<LongtailDbRow>): LongtailDbRow {
  return {
    no_waybill: 'WB',
    status_terakhir: 'DELIVERY',
    alasan_bermasalah: '',
    dp_sampai: 'BATANG01',
    waktu_sampai: '2026-07-20 09:00:00',
    umur_frozen: null,
    sprinter_delivery: '',
    cod: 'NONCOD',
    delivery_attempt: 0,
    feedback: '',
    log_feedback: '',
    perlu_review: false,
    version: 1,
    ...over,
  };
}

// "Hari ini" tetap utk determinisme: 2026-07-30 09:00 WIB (= 02:00 UTC).
const NOW = Date.UTC(2026, 6, 30, 2, 0, 0);

// ============================================================================
// AREA 3 — Freeze Aging & Resume (computeUmur / computeUmurLive)
// ============================================================================
describe('Umur: freeze saat Clear TTD & resume saat bukan Clear TTD', () => {
  it('3a. FREEZE: feedback Clear TTD + umur_frozen terisi -> pakai nilai beku, abaikan waktu berjalan', () => {
    // Meski waktu_sampai jauh di masa lalu (umur live besar), hasil = umur_frozen.
    const r = row({ feedback: 'Sudah TTD', umur_frozen: 5, waktu_sampai: '2020-01-01 00:00:00' });
    assert.equal(isClearTTD(r.feedback), true);
    assert.equal(computeUmur(r), 5); // beku di 5, tidak ikut bertambah
  });

  it('3b. RESUME: feedback BUKAN Clear TTD -> abaikan umur_frozen, hitung live dari waktu_sampai', () => {
    // umur_frozen sengaja diisi 5, TAPI feedback tak lagi mengandung TTD ->
    // computeUmur harus jatuh ke perhitungan live (bukan mengembalikan 5).
    const r = row({ feedback: 'On Delivery', umur_frozen: 5, waktu_sampai: '2020-01-01 00:00:00' });
    assert.equal(isClearTTD(r.feedback), false);
    const umur = computeUmur(r);
    assert.notEqual(umur, 5, 'harus TIDAK mengembalikan nilai beku 5');
    assert.equal(typeof umur, 'number');
    assert.ok((umur as number) > 1000, 'waktu_sampai 2020 -> umur live ribuan hari (resume jalan)');
  });

  it('3b. RESUME (nilai presisi): selisih tanggal kalender Jakarta, injeksi now', () => {
    // Sampai 2026-07-28 (WIB), hari ini 2026-07-30 (WIB) -> 2 hari kalender.
    assert.equal(computeUmurLive('2026-07-28 10:50:29', NOW), 2);
    // Sampai hari ini -> 0. Sampai kemarin malam -> 1.
    assert.equal(computeUmurLive('2026-07-30 08:00:00', NOW), 0);
    assert.equal(computeUmurLive('2026-07-29 23:59:00', NOW), 1);
  });
});

// ============================================================================
// AREA 4 — Close Alur / Auto-Close (decideAutoClose / planAutoClose)
// ============================================================================
describe('Auto-Close: keputusan arsip per baris (decideAutoClose)', () => {
  it('4c. Clear TTD -> arsip sbg "Clear TTD", status & umur beku TIDAK diubah', () => {
    const r = row({ feedback: 'Paket sudah TTD', status_terakhir: 'DELIVERY', umur_frozen: 3 });
    const d = decideAutoClose(r, NOW);
    assert.equal(d.tipeClose, 'Clear TTD');
    assert.equal(d.statusTerakhir, 'DELIVERY', 'status lama dipertahankan apa adanya');
    assert.equal(d.umurFrozen, 3, 'umur_frozen dipertahankan apa adanya');
    assert.equal(d.dataBaru, 'Clear TTD');
  });

  it('4c. BUKAN Clear TTD -> arsip sbg "CLOSE ALUR", status di-set CLOSE ALUR, umur di-freeze', () => {
    const r = row({ feedback: 'On Delivery', status_terakhir: 'KIRIM_MOBIL', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null });
    const d = decideAutoClose(r, NOW);
    assert.equal(d.tipeClose, 'Close Alur');
    assert.equal(d.statusTerakhir, 'CLOSE ALUR');
    assert.equal(d.umurFrozen, 2, 'umur di-freeze = umur live saat close (28->30 Jul = 2)');
    assert.equal(d.dataLama, 'KIRIM_MOBIL', 'jejak status sebelum diarsipkan');
    assert.equal(d.dataBaru, 'CLOSE ALUR');
  });
});

describe('Auto-Close: perencanaan (planAutoClose)', () => {
  it('4a. Deteksi hilang: waybill di active yg TIDAK muncul di file -> masuk plan; yg muncul -> dilewati', () => {
    const active = [
      row({ no_waybill: 'WB-ADA', feedback: 'On Delivery' }),      // muncul di file -> skip
      row({ no_waybill: 'WB-HILANG', feedback: 'On Delivery' }),   // hilang -> close
    ];
    const present = new Set(['wb-ada']); // lowercase (spt import.ts:264)
    const plan = planAutoClose(active, present, NOW);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].row.no_waybill, 'WB-HILANG');
    assert.equal(plan[0].decision.tipeClose, 'Close Alur');
  });

  it('4b. SCOPE PER DP: import 1 DP tak boleh meng-close waybill DP lain', () => {
    // Model alur import.ts:262-286 — active HANYA berisi baris DP yg ada di file.
    const semuaBarisLongtail = [
      row({ no_waybill: 'A-HADIR', dp_sampai: 'BATANG01' }),
      row({ no_waybill: 'A-HILANG', dp_sampai: 'BATANG01' }), // DP di file, hilang -> harus close
      row({ no_waybill: 'B-AMAN-1', dp_sampai: 'SUBAH01' }),  // DP LAIN, tak ikut import
      row({ no_waybill: 'B-AMAN-2', dp_sampai: 'SUBAH01' }),  // DP LAIN, tak ikut import
    ];
    // File hanya berisi 1 waybill DP BATANG01.
    const fileRows = [{ no_waybill: 'A-HADIR', dp_sampai: 'BATANG01' }];
    const presentLower = new Set(fileRows.map((r) => r.no_waybill.toLowerCase()));
    const dpsInFile = [...new Set(fileRows.map((r) => r.dp_sampai))];
    // import.ts:271-284 — active difilter ke DP yg ada di file SAJA.
    const active = semuaBarisLongtail.filter((r) => dpsInFile.includes(String(r.dp_sampai)));

    const plan = planAutoClose(active, presentLower, NOW);
    const closedWb = plan.map((p) => p.row.no_waybill);

    assert.deepEqual(closedWb, ['A-HILANG'], 'HANYA A-HILANG (DP di file) yg ter-close');
    assert.ok(!closedWb.includes('B-AMAN-1'), 'DP lain TIDAK boleh ter-close');
    assert.ok(!closedWb.includes('B-AMAN-2'), 'DP lain TIDAK boleh ter-close');
  });

  it('4b (guard). Membuktikan filter DP adalah pengaman yg menanggung: kalau baris DP lain BOCOR ke active, ia AKAN ter-close', () => {
    // Test dokumentasi: menegaskan planAutoClose sendiri TIDAK menyaring DP —
    // keamanannya bergantung penuh pada import.ts memfilter `active` (test di atas).
    const activeBocor = [row({ no_waybill: 'B-BOCOR', dp_sampai: 'SUBAH01', feedback: 'On Delivery' })];
    const presentLower = new Set(['a-hadir']); // file DP BATANG01, tak memuat B-BOCOR
    const plan = planAutoClose(activeBocor, presentLower, NOW);
    assert.equal(plan.length, 1, 'kalau baris DP lain bocor ke active, planAutoClose akan menutupnya');
  });
});
