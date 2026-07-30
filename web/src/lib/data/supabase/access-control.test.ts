// Verifikasi PERSISTEN batas keamanan data antar Drop Point ("akses per DP")
// — gap yang ditemukan saat regression check sebelum merge PR: sameDp()/
// FORBIDDEN ada di kode tapi belum pernah diuji EKSEKUSI. Test ini menjalankan
// fungsi PRODUKSI ASLI (getLongTail, submitFeedback, updateLongTail,
// listLongTail, getDashboard, listRiwayatFeedback — bukan replika) dengan
// meng-intercept HANYA boundary I/O (`db()` di client.ts) via mock.module
// Node bawaan, supaya seluruh logic otorisasi & scoping DB-query yang
// sesungguhnya ikut teruji apa adanya.
//
// Jalankan: `npm test` (script sudah menyertakan flag
// --experimental-test-module-mocks yang dibutuhkan mock.module).
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

// ============================================================================
// Fixture: 2 user (Admin DP BATANG01, Admin Cabang), 2 DP, 2 waybill (satu di
// tiap DP) - persis skenario yg diminta.
// ============================================================================
function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { email: 'admindp.batang@ltms.test', nama: 'Admin DP Batang', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
    { email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
  ]);
  store.set('longtail', [
    { no_waybill: 'WB-BATANG', status_terakhir: 'DELIVERY', alasan_bermasalah: '', dp_sampai: 'BATANG01', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
    { no_waybill: 'WB-BANDAR', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'BANDAR01', waktu_sampai: '2026-07-27 09:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
  ]);
  store.set('activity_log', []);
  store.set('longtail_archive', []);
  return store;
}

const ADMIN_DP_BATANG = 'admindp.batang@ltms.test';
const ADMIN_CABANG = 'admincabang@ltms.test';

describe('Akses per DP: batas keamanan data antar Drop Point (eksekusi nyata, fungsi produksi asli)', () => {
  let longtail: typeof import('./longtail.ts');
  let dashboard: typeof import('./dashboard.ts');
  let riwayat: typeof import('./riwayat-feedback.ts');
  // `let` (bukan const) SENGAJA - direassign fresh di beforeEach supaya tiap
  // `it()` mulai dari fixture bersih & terisolasi (beberapa test di bawah
  // MENULIS/memutasi data, mis. test #3 memindahkan dp_sampai WB-BANDAR -
  // tanpa isolasi ini, test setelahnya bisa "bocor" melihat efek mutasi test
  // sebelumnya, seolah-olah itu bug scoping padahal cuma state test yg tak
  // di-reset).
  let store: Map<string, Row[]>;

  before(async () => {
    // Intercept HANYA boundary I/O (db() di client.ts) - seluruh logic
    // otorisasi/scoping di longtail.ts/dashboard.ts/riwayat-feedback.ts
    // adalah kode PRODUKSI ASLI, tak disentuh sama sekali. Fungsi db() yg
    // di-mock SENGAJA membaca variabel `store` LUAR tiap dipanggil (bukan
    // menutup nilai `store` saat registrasi) - supaya reassignment `store`
    // di beforeEach di bawah benar2 dipakai tiap test, bukan snapshot lama.
    // Specifier HARUS persis sama dgn yg dipakai longtail.ts (import { db }
    // from './client' - tanpa ekstensi, konvensi app ini) - beda specifier
    // (mis. './client.ts') dianggap modul lain oleh resolver mock.module.
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    longtail = await import('./longtail.ts');
    dashboard = await import('./dashboard.ts');
    riwayat = await import('./riwayat-feedback.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('1. Admin DP BATANG01 mengakses/mengedit waybill DP LAIN (BANDAR01) via API langsung -> DITOLAK FORBIDDEN', async () => {
    await assert.rejects(
      () => longtail.getLongTail(ADMIN_DP_BATANG, 'WB-BANDAR'),
      (err: unknown) => (err as { code?: string }).code === 'FORBIDDEN',
      'getLongTail harus FORBIDDEN utk waybill DP lain',
    );
    await assert.rejects(
      () => longtail.submitFeedback(ADMIN_DP_BATANG, 'WB-BANDAR', 'On Delivery'),
      (err: unknown) => (err as { code?: string }).code === 'FORBIDDEN',
      'submitFeedback harus FORBIDDEN utk waybill DP lain',
    );
    // updateLongTail sekarang Admin-Cabang-only (fix bug DP-boundary di
    // commit ini) - Admin DP ditolak SEBELUM sempat sampai ke pengecekan
    // waybill/DP sama sekali, kode FORBIDDEN yg sama.
    await assert.rejects(
      () => longtail.updateLongTail(ADMIN_DP_BATANG, 'WB-BANDAR', { statusTerakhir: 'HACKED' }),
      (err: unknown) => (err as { code?: string }).code === 'FORBIDDEN',
      'updateLongTail harus FORBIDDEN utk Admin DP (role-based, bukan sameDp)',
    );
  });

  it('2. Admin DP BATANG01 mengakses/mengedit waybill DP MILIKNYA SENDIRI (BATANG01) -> berhasil normal', async () => {
    const got = await longtail.getLongTail(ADMIN_DP_BATANG, 'WB-BATANG');
    assert.equal(got['No. Waybill'], 'WB-BATANG');

    const updated = await longtail.submitFeedback(ADMIN_DP_BATANG, 'WB-BATANG', 'On Delivery - diisi Admin DP');
    assert.equal(updated.Feedback, 'On Delivery - diisi Admin DP');

    // updateLongTail (edit field umum spt status_terakhir/dp_sampai) TETAP
    // ditolak - ini bug yg diperbaiki: Admin DP TIDAK PERNAH punya hak edit
    // baris umum sama sekali (PRD Bagian 5: "hanya dapat MELIHAT"), bukan
    // cuma dibatasi ke DP-nya sendiri. Sebelum fix, request PERSIS ini akan
    // LOLOS dan bisa memindahkan dp_sampai keluar dari BATANG01.
    await assert.rejects(
      () => longtail.updateLongTail(ADMIN_DP_BATANG, 'WB-BATANG', { dpSampai: 'BANDAR01' }),
      (err: unknown) => (err as { code?: string }).code === 'FORBIDDEN',
      'Admin DP TIDAK BOLEH bisa mengubah dp_sampai baris miliknya sendiri via updateLongTail',
    );
  });

  it('3. Admin Cabang bisa akses SEMUA DP tanpa terbatasi sameDp() (PRD Bagian 5)', async () => {
    const batang = await longtail.getLongTail(ADMIN_CABANG, 'WB-BATANG');
    const bandar = await longtail.getLongTail(ADMIN_CABANG, 'WB-BANDAR');
    assert.equal(batang['No. Waybill'], 'WB-BATANG');
    assert.equal(bandar['No. Waybill'], 'WB-BANDAR');

    await longtail.submitFeedback(ADMIN_CABANG, 'WB-BANDAR', 'Reschedule oleh Admin Cabang');
    const afterSubmit = await longtail.getLongTail(ADMIN_CABANG, 'WB-BANDAR');
    assert.equal(afterSubmit.Feedback, 'Reschedule oleh Admin Cabang');

    // Admin Cabang JUGA satu-satunya yang boleh updateLongTail (termasuk
    // dp_sampai) - ini memang hak penuhnya, bukan celah.
    const moved = await longtail.updateLongTail(ADMIN_CABANG, 'WB-BANDAR', { dpSampai: 'BATANG01' });
    assert.equal(moved['DP Sampai'], 'BATANG01');

    const list = await longtail.listLongTail(ADMIN_CABANG);
    assert.equal(list.length, 2, 'Admin Cabang melihat SEMUA DP tanpa filter');
  });

  it('4a. GET list (listLongTail): Admin DP di-scope KE DP-nya di level query DB, bukan cuma filter setelah fetch', async () => {
    const rows = await longtail.listLongTail(ADMIN_DP_BATANG);
    assert.deepEqual(rows.map((r) => r['No. Waybill']), ['WB-BATANG'], 'HANYA baris BATANG01 yg dikembalikan');
    assert.ok(!rows.some((r) => r['DP Sampai'] === 'BANDAR01'), 'baris DP lain tak boleh bocor sama sekali ke response');
  });

  it('4b. Dashboard (getDashboard): scoping dp konsisten dgn longtail - Admin DP hanya lihat agregat DP-nya', async () => {
    const dash = await dashboard.getDashboard(ADMIN_DP_BATANG);
    assert.equal(dash.summary.total, 1, 'Admin DP BATANG01 hanya melihat 1 baris (miliknya), bukan 2 (semua DP)');

    const dashCabang = await dashboard.getDashboard(ADMIN_CABANG);
    assert.equal(dashCabang.summary.total, 2, 'Admin Cabang melihat agregat SEMUA DP');
  });

  it('4c. Riwayat Feedback (listRiwayatFeedback): scoping dp konsisten - Admin DP hanya lihat log DP-nya', async () => {
    // Fixture activity_log eksplisit (independen dari test lain - beforeEach
    // sudah mereset `store`, jadi tak boleh lagi mengandalkan efek samping
    // submitFeedback di test #2/#3). dp DICATAT saat kejadian terjadi, bukan
    // ikut berubah retroaktif kalau baris LongTail-nya kemudian dipindah DP.
    store.set('activity_log', [
      { waybill: 'WB-BATANG', user_email: ADMIN_DP_BATANG, dp: 'BATANG01', attempt_ke: 1, data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: '2026-07-28T10:00:00+07:00' },
      { waybill: 'WB-BANDAR', user_email: ADMIN_CABANG, dp: 'BANDAR01', attempt_ke: 1, data_baru: 'Reschedule', sumber: 'Manual Feedback', created_at: '2026-07-27T09:00:00+07:00' },
    ]);

    const logBatang = await riwayat.listRiwayatFeedback(ADMIN_DP_BATANG);
    assert.ok(logBatang.every((r) => r.dp === 'BATANG01'), 'Admin DP BATANG01 tak boleh melihat log DP lain sama sekali');
    assert.ok(logBatang.length > 0, 'tapi tetap melihat log DP-nya sendiri');

    const logCabang = await riwayat.listRiwayatFeedback(ADMIN_CABANG);
    assert.ok(
      logCabang.some((r) => r.dp === 'BANDAR01') && logCabang.some((r) => r.dp === 'BATANG01'),
      'Admin Cabang melihat log lintas-DP',
    );
  });
});
