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
  decideFeedbackTransition,
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
// AREA 3 (perbaikan) — Koreksi Clear TTD (decideFeedbackTransition)
// dipakai submitFeedback, longtail.ts. Mengisi gap 3b/3c/3d yang ditemukan
// audit: sebelumnya submitFeedback MEMBLOKIR total submit ulang pada baris
// Clear TTD (ALREADY_CLEAR_TTD) sehingga skenario koreksi tak pernah bisa
// dipicu sama sekali — sekarang dibuka, dgn aturan freeze/resume eksplisit.
// ============================================================================
describe('decideFeedbackTransition: transisi status Clear TTD saat submit feedback', () => {
  it('belum Clear TTD -> jadi Clear TTD: freeze umur BARU di momen ini, sumber Manual Feedback', () => {
    const current = { feedback: 'On Delivery', waktu_sampai: '2026-07-28 10:00:00' };
    const t = decideFeedbackTransition(current, 'Sudah TTD diterima', NOW);
    assert.equal(t.umurFrozen, 2, 'freeze = umur live saat ini (28->30 Jul = 2)');
    assert.equal(t.sumber, 'Manual Feedback');
    assert.equal(t.dataLama, 'On Delivery');
  });

  it('3c/3d. SUDAH Clear TTD -> KOREKSI ke status lain: lepas freeze (null), sumber "Koreksi Manual", dataLama="Clear TTD"', () => {
    const current = { feedback: 'Sudah TTD diterima', waktu_sampai: '2026-07-20 09:00:00' };
    const t = decideFeedbackTransition(current, 'On Delivery (dikoreksi)', NOW);
    assert.equal(t.umurFrozen, null, 'umur_frozen dilepas (bukan undefined, harus benar2 di-null-kan di DB)');
    assert.equal(t.sumber, 'Koreksi Manual', 'BUKAN "Manual Feedback" biasa');
    assert.equal(t.dataLama, 'Clear TTD', 'jejak status sebelum dikoreksi, bukan teks feedback lama apa adanya');
  });

  it('guard regresi: SUDAH Clear TTD, disubmit ulang dgn teks Clear TTD LAIN (bukan koreksi) -> umur_frozen TAK disentuh (bukan di-freeze ulang di momen lebih baru)', () => {
    // Ini skenario yg baru mungkin terjadi setelah ALREADY_CLEAR_TTD dibuka -
    // tanpa guard ini, resubmit teks Clear TTD lain akan menggeser freeze ke
    // "now" tiap kali, padahal harus tetap di momen Clear TTD PERTAMA.
    const current = { feedback: 'Sudah TTD (versi 1)', waktu_sampai: '2026-07-01 09:00:00' };
    const t = decideFeedbackTransition(current, 'Sudah TTD (versi 2, catatan tambahan)', NOW);
    assert.equal(t.umurFrozen, undefined, 'TIDAK disentuh - beda dari kasus baru-freeze (yg return angka) & koreksi (yg return null)');
    assert.equal(t.sumber, 'Manual Feedback');
  });

  it('guard: edit biasa (bukan & tetap bukan Clear TTD) -> umur_frozen tak disentuh, sumber Manual Feedback', () => {
    const current = { feedback: 'On Delivery', waktu_sampai: '2026-07-28 10:00:00' };
    const t = decideFeedbackTransition(current, 'Reschedule', NOW);
    assert.equal(t.umurFrozen, undefined);
    assert.equal(t.sumber, 'Manual Feedback');
    assert.equal(t.dataLama, 'On Delivery');
  });
});

describe('Lifecycle penuh: submit Clear TTD -> beku -> koreksi -> resume (simulasi eksekusi nyata)', () => {
  it('mereplikasi persis alur submitFeedback (longtail.ts) memakai fungsi produksi asli', () => {
    // "DB" longtail baris tunggal, dimulai dari status operasional biasa.
    let dbRow: LongtailDbRow = row({
      no_waybill: 'WB-LIFECYCLE',
      feedback: 'On Delivery',
      waktu_sampai: '2026-07-20 09:00:00', // 10 hari sebelum NOW (30 Jul)
      umur_frozen: null,
      version: 5,
    });

    /** Mereplikasi persis longtail.ts:72-108 (patch construction only, bukan network I/O). */
    function applySubmit(current: LongtailDbRow, newFeedback: string, now: number) {
      const t = decideFeedbackTransition(current, newFeedback, now);
      const next: LongtailDbRow = {
        ...current,
        feedback: newFeedback,
        version: current.version + 1,
        ...(t.umurFrozen !== undefined ? { umur_frozen: t.umurFrozen } : {}),
      };
      return { next, log: { dataLama: t.dataLama, dataBaru: newFeedback, sumber: t.sumber } };
    }

    // CATATAN PENTING soal determinisme: computeUmur(r) TIDAK menerima
    // parameter `now` (by design produksi - selalu baca Date.now() nyata,
    // krn dipanggil saat render sungguhan). Jadi utk langkah yg jatuh ke
    // JALUR LIVE (bukan beku), test ini memanggil computeUmurLive(waktuSampai,
    // now) LANGSUNG dgn `now` yang di-inject, supaya hasilnya deterministik
    // & TAK bergantung kapan `npm test` benar-benar dijalankan. computeUmur(r)
    // baru dipakai lagi begitu jalur BEKU aktif (cabang itu tak pernah
    // menyentuh Date.now() sama sekali - lihat longtail-pure.ts:100-107).

    // Langkah 1: sebelum Clear TTD, umur live (hitung dari waktu_sampai, 20->30 Jul = 10 hari).
    const umurSebelum = computeUmurLive(dbRow.waktu_sampai, NOW);
    console.log(`[lifecycle] Sebelum Clear TTD: umur = ${umurSebelum} (harus live, hitung dari waktu_sampai)`);
    assert.equal(umurSebelum, 10);

    // Langkah 2: submit Clear TTD.
    const step2 = applySubmit(dbRow, 'Sudah TTD diterima penerima', NOW);
    dbRow = step2.next;
    console.log(`[lifecycle] Submit Clear TTD -> umur_frozen=${dbRow.umur_frozen}, umur() = ${computeUmur(dbRow)} (harus BEKU di 10)`);
    assert.equal(dbRow.umur_frozen, 10, 'freeze di momen Clear TTD (umur live saat itu = 10)');
    assert.equal(computeUmur(dbRow), 10, 'umur() (jalur beku, tak sentuh Date.now()) mengembalikan nilai beku');
    assert.equal(step2.log.sumber, 'Manual Feedback');

    // Langkah 3: waktu berjalan 5 hari (simulasi "waktu berlalu") - umur HARUS
    // TETAP beku di 10. computeUmur(dbRow) aman dipanggil di sini APA ADANYA
    // (tanpa injeksi) krn baris masih Clear TTD -> cabang beku, tak pernah
    // membaca jam sama sekali, jadi hasilnya tak berubah walau real time maju.
    const fiveDaysLater = NOW + 5 * 24 * 60 * 60 * 1000;
    console.log(`[lifecycle] +5 hari kemudian (blm dikoreksi): umur() = ${computeUmur(dbRow)} (harus TETAP 10, tak ikut jalan)`);
    assert.equal(computeUmur(dbRow), 10, 'freeze tak boleh ikut bertambah walau waktu berjalan');

    // Langkah 4: KOREKSI - ternyata salah tandai Clear TTD, kembalikan ke status lain.
    const step4 = applySubmit(dbRow, 'Reschedule (sebelumnya salah ditandai)', fiveDaysLater);
    dbRow = step4.next;
    assert.equal(dbRow.umur_frozen, null, 'freeze dilepas');
    // Resume LIVE dari waktu_sampai ASLI (2026-07-20), dihitung pada waktu
    // (fiveDaysLater) -> 20 Jul ke 4 Agu (30 Jul + 5) = 15 hari. BUKAN
    // "lanjut dari 10". Pakai computeUmurLive langsung (bukan computeUmur)
    // supaya `now` yang di-inject benar2 dipakai, bukan Date.now() nyata.
    const umurSetelahKoreksi = computeUmurLive(dbRow.waktu_sampai, fiveDaysLater);
    console.log(`[lifecycle] KOREKSI ke non-Clear-TTD -> umur_frozen=${dbRow.umur_frozen}, umur live pd waktu koreksi = ${umurSetelahKoreksi} (harus RESUME dari waktu_sampai ASLI, bukan lanjut dari 10)`);
    assert.equal(umurSetelahKoreksi, 15, 'resume dari waktu_sampai asli, BUKAN melanjutkan angka beku 10');
    assert.notEqual(umurSetelahKoreksi, 10, 'eksplisit: TIDAK melanjutkan dari angka beku');
    // Sanity tambahan: computeUmur(dbRow) SEKARANG (tanpa injeksi, jalur live
    // sungguhan) juga harus > umur sebelum Clear TTD (10) krn waktu terus
    // berjalan sejak baris ini dibuat - longgar (>=10), bukan nilai presisi,
    // krn bergantung real Date.now() saat test dijalankan.
    assert.ok((computeUmur(dbRow) as number) >= 10, 'umur() jalur live sungguhan juga ikut resume (bukan macet di 10)');

    // Langkah 5: Activity_Log harus mencatat "Koreksi Manual" dgn Data Lama="Clear TTD".
    console.log(`[lifecycle] Activity_Log: sumber="${step4.log.sumber}", dataLama="${step4.log.dataLama}", dataBaru="${step4.log.dataBaru}"`);
    assert.equal(step4.log.sumber, 'Koreksi Manual');
    assert.equal(step4.log.dataLama, 'Clear TTD');
    assert.equal(step4.log.dataBaru, 'Reschedule (sebelumnya salah ditandai)');

    console.log('[lifecycle] SEMUA tahap sesuai ekspektasi: freeze->beku->koreksi->resume->log tercatat benar.');
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
