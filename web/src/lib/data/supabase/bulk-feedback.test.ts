// Verifikasi bulk feedback CHUNKED-PARALLEL (Promise.allSettled per chunk
// BULK_FEEDBACK_CHUNK_SIZE, chunk demi chunk berurutan) — pengganti loop
// sekuensial 1-per-1 yang bikin bulk 100 AWB makan beberapa menit (lihat
// komentar bulkSubmitFeedback, longtail.ts). Menjalankan fungsi PRODUKSI
// ASLI (bulkSubmitFeedback -> submitFeedback yang SAMA PERSIS dgn submit
// satu-per-satu) dengan meng-intercept HANYA boundary I/O (db()), pola
// sama dgn access-control.test.ts.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

const ADMIN_CABANG = 'admincabang@ltms.test';
const TOTAL_WAYBILL = 100;

function seedWaybills(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    no_waybill: `WB-${String(i + 1).padStart(3, '0')}`,
    status_terakhir: 'DELIVERY',
    alasan_bermasalah: '',
    dp_sampai: 'BATANG01',
    waktu_sampai: '2026-08-01 10:00:00',
    umur_frozen: null,
    sprinter_delivery: '',
    cod: 'NONCOD',
    delivery_attempt: 0,
    feedback: '',
    log_feedback: '',
    perlu_review: false,
    version: 1,
  }));
}

function freshStore(n: number): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { id: 'u-admincabang', email: ADMIN_CABANG, nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
  ]);
  store.set('longtail', seedWaybills(n));
  store.set('activity_log', []);
  store.set('longtail_archive', []);
  store.set('master_drop_point', []);
  store.set('role_permissions', []);
  store.set('user_permissions', []);
  return store;
}

describe('Bulk Feedback: chunked-parallel (eksekusi nyata, fungsi produksi asli)', () => {
  let longtail: typeof import('./longtail.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    longtail = await import('./longtail.ts');
  });

  beforeEach(() => {
    store = freshStore(TOTAL_WAYBILL);
  });

  after(() => mock.reset());

  it(`1. Bulk ${TOTAL_WAYBILL} AWB: semua berhasil, tiap baris & Activity_Log ter-update benar (menembus >1 chunk, BULK_FEEDBACK_CHUNK_SIZE=15)`, async () => {
    const items = (store.get('longtail') ?? []).map((r) => ({ waybill: String(r.no_waybill) }));
    const result = await longtail.bulkSubmitFeedback(ADMIN_CABANG, items, 'Selesai Diantar');

    assert.equal(result.successCount, TOTAL_WAYBILL);
    assert.equal(result.failCount, 0);
    assert.equal(result.results.length, TOTAL_WAYBILL);

    // Urutan hasil HARUS identik dgn urutan item input (posisi per index),
    // bukan cuma sama sbg set - UI/laporan bergantung pada ini.
    result.results.forEach((r, i) => assert.equal(r.waybill, items[i].waybill));

    const rows = store.get('longtail') ?? [];
    assert.equal(rows.length, TOTAL_WAYBILL);
    for (const row of rows) {
      assert.equal(row.feedback, 'Selesai Diantar', `${row.no_waybill} feedback harus ter-update`);
      assert.equal(row.version, 2, `${row.no_waybill} version harus naik jadi 2`);
      assert.match(String(row.log_feedback), /Selesai Diantar$/);
    }

    const logs = store.get('activity_log') ?? [];
    assert.equal(logs.length, TOTAL_WAYBILL, 'satu entry Activity_Log per waybill, tidak kurang/lebih/dobel');
    const loggedWaybills = new Set(logs.map((l) => l.waybill));
    assert.equal(loggedWaybills.size, TOTAL_WAYBILL, 'tiap waybill dapat TEPAT satu entry log, tak ada yang hilang/dobel');
    for (const l of logs) {
      assert.equal(l.data_baru, 'Selesai Diantar');
      assert.equal(l.attempt_ke, 1, 'attempt pertama per waybill (activity_log kosong sebelum bulk ini)');
    }
  });

  it('2. Pembuktian output-equivalence: hasil chunked-parallel IDENTIK dengan simulasi sekuensial 1-per-1 pada fixture terpisah', async () => {
    // Baseline: reproduksi PERSIS perilaku implementasi LAMA (for-loop
    // sekuensial memanggil submitFeedback satu-per-satu) di fixture store
    // TERPISAH, supaya bisa dibandingkan apple-to-apple dengan hasil
    // bulkSubmitFeedback (chunked-parallel) di fixture lain yang identik.
    const storeA = freshStore(TOTAL_WAYBILL); // sekuensial (baseline lama)
    const storeB = freshStore(TOTAL_WAYBILL); // chunked-parallel (implementasi baru)
    const items = (storeA.get('longtail') ?? []).map((r) => ({ waybill: String(r.no_waybill) }));

    store = storeA;
    for (const item of items) {
      await longtail.submitFeedback(ADMIN_CABANG, item.waybill, 'Klaim Diterima Konsumen');
    }

    store = storeB;
    const bulkResult = await longtail.bulkSubmitFeedback(ADMIN_CABANG, items, 'Klaim Diterima Konsumen');
    assert.equal(bulkResult.successCount, TOTAL_WAYBILL);

    // Bandingkan state akhir kedua store: HARUS identik (jumlah baris
    // ter-update, isi Feedback/version, jumlah & isi Activity_Log) - tak
    // ada yang tertinggal/hilang akibat paralelisasi.
    const rowsA = [...(storeA.get('longtail') ?? [])].sort((a, b) => String(a.no_waybill).localeCompare(String(b.no_waybill)));
    const rowsB = [...(storeB.get('longtail') ?? [])].sort((a, b) => String(a.no_waybill).localeCompare(String(b.no_waybill)));
    assert.deepEqual(
      rowsB.map((r) => ({ waybill: r.no_waybill, feedback: r.feedback, version: r.version, log: r.log_feedback })),
      rowsA.map((r) => ({ waybill: r.no_waybill, feedback: r.feedback, version: r.version, log: r.log_feedback })),
    );

    const logsA = [...(storeA.get('activity_log') ?? [])].sort((a, b) => String(a.waybill).localeCompare(String(b.waybill)));
    const logsB = [...(storeB.get('activity_log') ?? [])].sort((a, b) => String(a.waybill).localeCompare(String(b.waybill)));
    assert.equal(logsB.length, logsA.length);
    assert.deepEqual(
      logsB.map((l) => ({ waybill: l.waybill, dataBaru: l.data_baru, attempt: l.attempt_ke, sumber: l.sumber })),
      logsA.map((l) => ({ waybill: l.waybill, dataBaru: l.data_baru, attempt: l.attempt_ke, sumber: l.sumber })),
    );
  });

  it('3. 1 waybill gagal (VERSION_CONFLICT) di TENGAH sebuah chunk TIDAK membatalkan waybill lain di chunk yang sama (Promise.allSettled, bukan Promise.all)', async () => {
    // 5 waybill, semua masuk SATU chunk (< BULK_FEEDBACK_CHUNK_SIZE=15).
    // WB-003 dikirim dgn baseVersion basi (simulasi sudah diubah proses
    // lain sesaat sebelum bulk ini jalan) - harus gagal VERSION_CONFLICT
    // TANPA menggagalkan WB-001/002/004/005 yang diproses bersamaan.
    const five = (store.get('longtail') ?? []).slice(0, 5);
    const items = five.map((r) => ({
      waybill: String(r.no_waybill),
      baseVersion: r.no_waybill === 'WB-003' ? '999' : undefined,
    }));

    const result = await longtail.bulkSubmitFeedback(ADMIN_CABANG, items, 'Retur ke Gudang');

    assert.equal(result.successCount, 4);
    assert.equal(result.failCount, 1);

    const failed = result.results.find((r) => r.waybill === 'WB-003');
    assert.ok(failed && !failed.ok, 'WB-003 harus gagal');
    if (failed && !failed.ok) assert.equal(failed.code, 'VERSION_CONFLICT');

    for (const wb of ['WB-001', 'WB-002', 'WB-004', 'WB-005']) {
      const r = result.results.find((x) => x.waybill === wb);
      assert.ok(r?.ok, `${wb} di chunk yang sama harus tetap berhasil walau WB-003 gagal`);
    }

    // WB-003 di DB tidak berubah sama sekali (gagal sebelum update).
    const wb003 = (store.get('longtail') ?? []).find((r) => r.no_waybill === 'WB-003');
    assert.equal(wb003?.feedback, '', 'WB-003 gagal - feedback lama tak boleh ikut berubah');
    assert.equal(wb003?.version, 1);
  });
});
