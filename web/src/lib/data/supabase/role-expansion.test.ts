// Verifikasi PERSISTEN Langkah 3 (Perluasan Role): Manager Kota/Asisten
// Manager Kota/Super Admin harus berperilaku IDENTIK Admin Cabang di semua
// fungsi produksi ASLI (bukan cuma lolos requireRole, tapi juga scoping
// data), dan SPV Drop Point harus ter-scope ke SEMUA DP yang disupervisi
// (bisa >1, BEDA dari Admin DP yang selalu 1) - termasuk DITOLAK utk DP di
// luar cakupannya lewat pemanggilan fungsi langsung (setara API call
// langsung). Pola sama dgn access-control.test.ts: mock.module() HANYA di
// boundary db() (client.ts), seluruh logic otorisasi/scoping produksi asli.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

const SPV_ID = 'u-spv-dua-dp';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { id: 'u-admincabang', email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
    { id: 'u-manager', email: 'manager@ltms.test', nama: 'Manager Kota', role: 'Manager Kota', drop_point: '', status_aktif: true },
    { id: 'u-asisten', email: 'asisten@ltms.test', nama: 'Asisten Manager', role: 'Asisten Manager Kota', drop_point: '', status_aktif: true },
    { id: 'u-superadmin', email: 'superadmin@ltms.test', nama: 'Super Admin', role: 'Super Admin', drop_point: '', status_aktif: true },
    { id: SPV_ID, email: 'spv@ltms.test', nama: 'SPV Dua DP', role: 'SPV Drop Point', drop_point: '', status_aktif: true },
    { id: 'u-admindp', email: 'admindp@ltms.test', nama: 'Admin DP', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
  ]);
  store.set('master_drop_point', [
    { kode_dp: 'BATANG01', nama_dp: 'Batang 01', wilayah: 'Batang', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
    { kode_dp: 'BANDAR01', nama_dp: 'Bandar 01', wilayah: 'Bandar', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
    { kode_dp: 'SUBAH01', nama_dp: 'Subah 01', wilayah: 'Subah', status_aktif: true, kode_kota: null, spv_drop_point_user_id: null },
  ]);
  store.set('longtail', [
    { no_waybill: 'WB-BATANG', status_terakhir: 'DELIVERY', alasan_bermasalah: '', dp_sampai: 'BATANG01', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
    { no_waybill: 'WB-BANDAR', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'BANDAR01', waktu_sampai: '2026-07-27 09:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
    { no_waybill: 'WB-SUBAH', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'SUBAH01', waktu_sampai: '2026-07-26 08:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
  ]);
  store.set('activity_log', []);
  store.set('longtail_archive', []);
  return store;
}

const ADMIN_CABANG = 'admincabang@ltms.test';
const MANAGER_KOTA = 'manager@ltms.test';
const ASISTEN_MANAGER = 'asisten@ltms.test';
const SUPER_ADMIN = 'superadmin@ltms.test';
const SPV = 'spv@ltms.test';

describe('Langkah 3 - Perluasan Role: full access & SPV Drop Point (eksekusi nyata, fungsi produksi asli)', () => {
  let helpers: typeof import('./helpers.ts');
  let longtail: typeof import('./longtail.ts');
  let dashboard: typeof import('./dashboard.ts');
  let riwayat: typeof import('./riwayat-feedback.ts');
  let roles: typeof import('../../roles.ts');
  let nav: typeof import('../../nav.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    helpers = await import('./helpers.ts');
    longtail = await import('./longtail.ts');
    dashboard = await import('./dashboard.ts');
    riwayat = await import('./riwayat-feedback.ts');
    roles = await import('../../roles.ts');
    nav = await import('../../nav.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('1. requireRole: Manager Kota & Asisten Manager Kota lolos cek FULL_ACCESS_ROLES (setara Admin Cabang)', async () => {
    const manager = await helpers.requireActor(MANAGER_KOTA);
    const asisten = await helpers.requireActor(ASISTEN_MANAGER);
    assert.doesNotThrow(() => helpers.requireRole(manager, roles.FULL_ACCESS_ROLES));
    assert.doesNotThrow(() => helpers.requireRole(asisten, roles.FULL_ACCESS_ROLES));
  });

  it('2. requireRole: Super Admin BYPASS bahkan thd array yang TIDAK memuat "Super Admin" sama sekali', async () => {
    const actor = await helpers.requireActor(SUPER_ADMIN);
    assert.doesNotThrow(() => helpers.requireRole(actor, ['Admin Cabang']));
    assert.doesNotThrow(() => helpers.requireRole(actor, ['SPV Drop Point']));
    assert.doesNotThrow(() => helpers.requireRole(actor, []));
  });

  it('3. requireRole: Admin DP & SPV Drop Point TETAP FORBIDDEN thd FULL_ACCESS_ROLES (regresi - bukan ikut naik jadi full access)', async () => {
    const admindp = await helpers.requireActor('admindp@ltms.test');
    const spv = await helpers.requireActor(SPV);
    assert.throws(() => helpers.requireRole(admindp, roles.FULL_ACCESS_ROLES), (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN');
    assert.throws(() => helpers.requireRole(spv, roles.FULL_ACCESS_ROLES), (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN');
  });

  it('4. Manager Kota & Asisten Manager Kota: akses LongTail/Dashboard IDENTIK Admin Cabang (semua DP, tanpa batas)', async () => {
    for (const email of [MANAGER_KOTA, ASISTEN_MANAGER]) {
      const list = await longtail.listLongTail(email);
      assert.equal(list.length, 3, `${email} harus melihat SEMUA DP (3 baris), sama seperti Admin Cabang`);

      const dash = await dashboard.getDashboard(email);
      assert.equal(dash.summary.total, 3, `${email} agregat Dashboard harus mencakup semua DP`);

      const batang = await longtail.getLongTail(email, 'WB-BATANG');
      const bandar = await longtail.getLongTail(email, 'WB-SUBAH');
      assert.equal(batang['No. Waybill'], 'WB-BATANG');
      assert.equal(bandar['No. Waybill'], 'WB-SUBAH');

      const moved = await longtail.updateLongTail(email, 'WB-SUBAH', { dpSampai: 'BATANG01' });
      assert.equal(moved['DP Sampai'], 'BATANG01', `${email} harus bisa updateLongTail (termasuk pindah DP) - hak penuh spt Admin Cabang`);
    }
  });

  it('5. navForRole: Manager Kota & Asisten Manager Kota dapat menu SAMA PERSIS dgn Admin Cabang', () => {
    const cabangMenu = nav.navForRole('Admin Cabang');
    assert.deepEqual(nav.navForRole('Manager Kota'), cabangMenu);
    assert.deepEqual(nav.navForRole('Asisten Manager Kota'), cabangMenu);
    assert.deepEqual(nav.navForRole('Super Admin'), cabangMenu);
  });

  it('6. navForRole: SPV Drop Point dapat menu SAMA PERSIS dgn Admin DP', () => {
    assert.deepEqual(nav.navForRole('SPV Drop Point'), nav.navForRole('Admin DP'));
  });

  it('7. getSupervisedDPs: SPV Drop Point disupervisi TEPAT BATANG01 & BANDAR01, BUKAN SUBAH01', async () => {
    const dps = await helpers.getSupervisedDPs(SPV_ID);
    assert.deepEqual([...dps].sort(), ['BANDAR01', 'BATANG01']);
  });

  it('8. listLongTail: SPV Drop Point cuma lihat waybill di DP yang disupervisi (2 baris), BUKAN WB-SUBAH', async () => {
    const rows = await longtail.listLongTail(SPV);
    assert.deepEqual(rows.map((r) => r['No. Waybill']).sort(), ['WB-BANDAR', 'WB-BATANG']);
    assert.ok(!rows.some((r) => r['DP Sampai'] === 'SUBAH01'), 'baris DP yang tidak disupervisi tak boleh bocor sama sekali ke response');
  });

  it('9. getDashboard: SPV Drop Point agregat cuma dari 2 DP yang disupervisi (bukan 1, bukan 3)', async () => {
    const dash = await dashboard.getDashboard(SPV);
    assert.equal(dash.summary.total, 2);
  });

  it('10. listRiwayatFeedback: SPV Drop Point cuma lihat log dari DP yang disupervisi', async () => {
    store.set('activity_log', [
      { waybill: 'WB-BATANG', user_email: SPV, dp: 'BATANG01', attempt_ke: 1, data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: '2026-07-28T10:00:00+07:00' },
      { waybill: 'WB-SUBAH', user_email: 'lain@ltms.test', dp: 'SUBAH01', attempt_ke: 1, data_baru: 'Reschedule', sumber: 'Manual Feedback', created_at: '2026-07-26T08:00:00+07:00' },
    ]);
    const log = await riwayat.listRiwayatFeedback(SPV);
    assert.ok(log.every((r) => r.dp === 'BATANG01' || r.dp === 'BANDAR01'), 'SPV tak boleh melihat log DP yang tidak disupervisi');
    assert.ok(log.some((r) => r.dp === 'BATANG01'));
  });

  it('11. submitFeedback: SPV Drop Point BOLEH edit feedback di KEDUA DP yang disupervisi', async () => {
    const a = await longtail.submitFeedback(SPV, 'WB-BATANG', 'Reschedule oleh SPV');
    assert.equal(a.Feedback, 'Reschedule oleh SPV');
    const b = await longtail.submitFeedback(SPV, 'WB-BANDAR', 'On Delivery oleh SPV');
    assert.equal(b.Feedback, 'On Delivery oleh SPV');
  });

  it('12. getLongTail/submitFeedback: SPV Drop Point DITOLAK FORBIDDEN utk DP yang TIDAK disupervisi, via pemanggilan fungsi langsung (setara API langsung)', async () => {
    await assert.rejects(
      () => longtail.getLongTail(SPV, 'WB-SUBAH'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
    await assert.rejects(
      () => longtail.submitFeedback(SPV, 'WB-SUBAH', 'Coba akses DP lain'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('13. updateLongTail: SPV Drop Point TETAP DITOLAK (bukan full access) walau utk DP yang disupervisi sendiri', async () => {
    await assert.rejects(
      () => longtail.updateLongTail(SPV, 'WB-BATANG', { dpSampai: 'SUBAH01' }),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
      'SPV Drop Point tidak boleh memindahkan dp_sampai (hak sama seperti Admin DP: cuma submitFeedback)',
    );
  });

  it('14. Regresi: Admin Cabang & Admin DP existing TIDAK ADA perubahan perilaku (identik sebelum Langkah 3)', async () => {
    const list = await longtail.listLongTail(ADMIN_CABANG);
    assert.equal(list.length, 3, 'Admin Cabang tetap melihat SEMUA DP');

    const dpList = await longtail.listLongTail('admindp@ltms.test');
    assert.deepEqual(dpList.map((r) => r['No. Waybill']), ['WB-BATANG'], 'Admin DP tetap cuma DP-nya sendiri');

    await assert.rejects(
      () => longtail.getLongTail('admindp@ltms.test', 'WB-BANDAR'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });
});
