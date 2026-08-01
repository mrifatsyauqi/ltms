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
import { jakartaTodayIso } from './longtail-pure.ts';

const SPV_ID = 'u-spv-dua-dp';
const SPV_SATU_ID = 'u-spv-satu-dp';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { id: 'u-admincabang', email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
    { id: 'u-manager', email: 'manager@ltms.test', nama: 'Manager Kota', role: 'Manager Kota', drop_point: '', status_aktif: true },
    { id: 'u-asisten', email: 'asisten@ltms.test', nama: 'Asisten Manager', role: 'Asisten Manager Kota', drop_point: '', status_aktif: true },
    { id: 'u-superadmin', email: 'superadmin@ltms.test', nama: 'Super Admin', role: 'Super Admin', drop_point: '', status_aktif: true },
    { id: SPV_ID, email: 'spv@ltms.test', nama: 'SPV Dua DP', role: 'SPV Drop Point', drop_point: '', status_aktif: true },
    { id: SPV_SATU_ID, email: 'spvsatu@ltms.test', nama: 'SPV Satu DP', role: 'SPV Drop Point', drop_point: '', status_aktif: true },
    { id: 'u-admindp', email: 'admindp@ltms.test', nama: 'Admin DP', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
  ]);
  store.set('master_drop_point', [
    { kode_dp: 'BATANG01', nama_dp: 'Batang 01', wilayah: 'Batang', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
    { kode_dp: 'BANDAR01', nama_dp: 'Bandar 01', wilayah: 'Bandar', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
    { kode_dp: 'SUBAH01', nama_dp: 'Subah 01', wilayah: 'Subah', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_SATU_ID },
  ]);
  store.set('longtail', [
    { no_waybill: 'WB-BATANG', status_terakhir: 'DELIVERY', alasan_bermasalah: '', dp_sampai: 'BATANG01', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
    { no_waybill: 'WB-BANDAR', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'BANDAR01', waktu_sampai: '2026-07-27 09:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
    { no_waybill: 'WB-SUBAH', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'SUBAH01', waktu_sampai: '2026-07-26 08:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
  ]);
  store.set('activity_log', []);
  store.set('longtail_archive', []);
  store.set('dashboard_snapshot', [
    { tanggal: '2026-07-28', scope: 'BATANG01', data: { role: 'Admin DP', dropPoint: 'BATANG01', summary: { total: 1, sudahFeedback: 0, belumFeedback: 1, clearTTD: 0, belumClearTTD: 1, progressFeedbackPct: 0, paketTertua: 0, paketTertuaWaybill: '', paketLebih3Hari: 0, progressHariIni: 0 }, distribusiFeedback: [], aging: [], monitoringDp: [], progressPerSprinter: [] } },
    { tanggal: '2026-07-28', scope: 'BANDAR01', data: { role: 'Admin DP', dropPoint: 'BANDAR01', summary: { total: 1, sudahFeedback: 0, belumFeedback: 1, clearTTD: 0, belumClearTTD: 1, progressFeedbackPct: 0, paketTertua: 0, paketTertuaWaybill: '', paketLebih3Hari: 0, progressHariIni: 0 }, distribusiFeedback: [], aging: [], monitoringDp: [], progressPerSprinter: [] } },
  ]);
  store.set('jabatan', [
    { id: 'jab-super-admin', nama: 'Super Admin', tingkat: 1, deskripsi: null },
    { id: 'jab-admin-cabang', nama: 'Admin Cabang', tingkat: 2, deskripsi: null },
    { id: 'jab-manager-kota', nama: 'Manager Kota', tingkat: 3, deskripsi: null },
    { id: 'jab-asisten-manager', nama: 'Asisten Manager Kota', tingkat: 4, deskripsi: null },
    { id: 'jab-spv-dp', nama: 'SPV Drop Point', tingkat: 5, deskripsi: null },
    { id: 'jab-admin-dp', nama: 'Admin DP', tingkat: 6, deskripsi: null },
  ]);
  return store;
}

const ADMIN_CABANG = 'admincabang@ltms.test';
const MANAGER_KOTA = 'manager@ltms.test';
const ASISTEN_MANAGER = 'asisten@ltms.test';
const SUPER_ADMIN = 'superadmin@ltms.test';
const SPV = 'spv@ltms.test';
const SPV_SATU = 'spvsatu@ltms.test';

describe('Langkah 3 - Perluasan Role: full access & SPV Drop Point (eksekusi nyata, fungsi produksi asli)', () => {
  let helpers: typeof import('./helpers.ts');
  let longtail: typeof import('./longtail.ts');
  let dashboard: typeof import('./dashboard.ts');
  let riwayat: typeof import('./riwayat-feedback.ts');
  let roles: typeof import('../../roles.ts');
  let nav: typeof import('../../nav.ts');
  let users: typeof import('./users.ts');
  let dropPoints: typeof import('./drop-points.ts');
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
    users = await import('./users.ts');
    dropPoints = await import('./drop-points.ts');
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

  it('15. createUser: role "Manager Kota" berhasil, jabatan_id ikut disinkronkan, drop_point TETAP kosong', async () => {
    await users.createUser(ADMIN_CABANG, { nama: 'Budi Manager', email: 'budimanager@ltms.test', nik: 'NIK-BM', role: 'Manager Kota' });
    const list = await users.listUsers(ADMIN_CABANG);
    const row = list.find((u) => u.Email === 'budimanager@ltms.test');
    assert.ok(row);
    assert.equal(row!.Role, 'Manager Kota');
    assert.equal(row!['Drop Point'], '', 'Manager Kota tidak terikat 1 DP - drop_point harus kosong');
    const raw = store.get('users')!.find((u) => u.email === 'budimanager@ltms.test')!;
    assert.equal(raw.jabatan_id, 'jab-manager-kota');
  });

  it('16. createUser: role "SPV Drop Point" berhasil TANPA wajib isi dropPoint (di-assign lewat halaman Drop Point, bukan form ini)', async () => {
    await users.createUser(ADMIN_CABANG, { nama: 'Sari SPV', email: 'sarispv@ltms.test', nik: 'NIK-SS', role: 'SPV Drop Point' });
    const list = await users.listUsers(ADMIN_CABANG);
    const row = list.find((u) => u.Email === 'sarispv@ltms.test');
    assert.ok(row);
    assert.equal(row!.Role, 'SPV Drop Point');
    assert.equal(row!['Drop Point'], '');
  });

  it('17. createUser: role "Super Admin" -> VALIDATION_ERROR (TIDAK BISA dibuat lewat form/API, cuma SQL manual)', async () => {
    await assert.rejects(
      () => users.createUser(ADMIN_CABANG, { nama: 'Coba Jadi SA', email: 'cobasa@ltms.test', nik: 'NIK-SA2', role: 'Super Admin' as never }),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('18. updateUser: ganti role Admin DP -> Asisten Manager Kota mengosongkan drop_point & menyinkronkan jabatan_id', async () => {
    const updated = await users.updateUser(ADMIN_CABANG, 'admindp@ltms.test', { role: 'Asisten Manager Kota' });
    assert.equal(updated.Role, 'Asisten Manager Kota');
    assert.equal(updated['Drop Point'], '', 'drop_point harus dikosongkan - Asisten Manager Kota tidak terikat 1 DP');
    const raw = store.get('users')!.find((u) => u.email === 'admindp@ltms.test')!;
    assert.equal(raw.jabatan_id, 'jab-asisten-manager');
  });

  it('19. Manager Kota/Asisten Manager Kota bisa membuat user baru (requireRole FULL_ACCESS_ROLES di createUser) - hak penuh spt Admin Cabang', async () => {
    await users.createUser(MANAGER_KOTA, { nama: 'Dibuat Manager Kota', email: 'dibuatmanager@ltms.test', nik: 'NIK-DM', role: 'Admin DP', dropPoint: 'BATANG01' });
    const list = await users.listUsers(ADMIN_CABANG);
    assert.ok(list.some((u) => u.Email === 'dibuatmanager@ltms.test'));
  });

  // --------------------------------------------------------------------------
  // Perbaikan sidebar SPV Drop Point: listSupervisedDropPoints (sumber
  // SupervisedScopeBox) + narrowing `dp` di getDashboard/getDashboardSnapshot
  // - "cakupan"-nya SPV sekarang bisa dipersempit ke 1 dari DP yang
  // disupervisi (dropdown), bukan cuma agregat semua atau tanpa pilihan.
  // --------------------------------------------------------------------------

  it('20. listSupervisedDropPoints: SPV dgn 1 DP -> array panjang 1 (dasar utk sidebar tampil spt Admin DP)', async () => {
    const dps = await dropPoints.listSupervisedDropPoints(SPV_SATU);
    assert.deepEqual(dps.map((d) => d['Kode DP']), ['SUBAH01']);
  });

  it('21. listSupervisedDropPoints: SPV dgn 2 DP -> array terurut, dasar utk sidebar tampil dropdown', async () => {
    const dps = await dropPoints.listSupervisedDropPoints(SPV);
    assert.deepEqual(dps.map((d) => d['Kode DP']), ['BANDAR01', 'BATANG01']);
  });

  it('22. listSupervisedDropPoints: role selain SPV Drop Point -> array kosong (aman dipanggil role apapun)', async () => {
    const dps = await dropPoints.listSupervisedDropPoints(ADMIN_CABANG);
    assert.deepEqual(dps, []);
  });

  it('23. getDashboard: SPV Drop Point mempersempit ke 1 DP via `dp` (tervalidasi thd DP yang disupervisi sendiri) -> total cuma DP itu', async () => {
    const dash = await dashboard.getDashboard(SPV, 'BATANG01');
    assert.equal(dash.summary.total, 1);
  });

  it('24. getDashboard: SPV Drop Point kirim `dp` DP yang BUKAN cakupannya -> diabaikan, tetap agregat SEMUA DP disupervisi (TIDAK bocor ke DP lain)', async () => {
    const dash = await dashboard.getDashboard(SPV, 'SUBAH01'); // disupervisi SPV_SATU, bukan SPV
    assert.equal(dash.summary.total, 2, 'harus fallback ke agregat 2 DP miliknya, bukan 1 baris SUBAH01 & bukan error');
  });

  it('25. getDashboardSnapshot: SPV Drop Point mempersempit ke 1 DP via `dp` -> bisa baca snapshot DP itu (sebelumnya selalu null utk SPV multi-DP)', async () => {
    const snap = await dashboard.getDashboardSnapshot(SPV, '2026-07-28', 'BATANG01');
    assert.ok(snap, 'snapshot BATANG01 harus ketemu setelah dipersempit');
    assert.equal(snap!.summary.total, 1);
  });

  it('26. getDashboardSnapshot: SPV Drop Point TANPA mempersempit (masih "Semua DP Disupervisi", >1 DP) -> tetap null (belum ada agregat snapshot multi-DP)', async () => {
    const snap = await dashboard.getDashboardSnapshot(SPV, '2026-07-28');
    assert.equal(snap, null);
  });

  it('27. getDashboardSnapshot: SPV dgn TEPAT 1 DP disupervisi -> otomatis dapat snapshot DP-nya TANPA perlu kirim `dp` (jalur sama dgn Admin DP)', async () => {
    store.get('dashboard_snapshot')!.push({ tanggal: '2026-07-28', scope: 'SUBAH01', data: { role: 'Admin DP', dropPoint: 'SUBAH01', summary: { total: 1, sudahFeedback: 0, belumFeedback: 1, clearTTD: 0, belumClearTTD: 1, progressFeedbackPct: 0, paketTertua: 0, paketTertuaWaybill: '', paketLebih3Hari: 0, progressHariIni: 0 }, distribusiFeedback: [], aging: [], monitoringDp: [], progressPerSprinter: [] } });
    const snap = await dashboard.getDashboardSnapshot(SPV_SATU, '2026-07-28');
    assert.ok(snap);
    assert.equal(snap!.summary.total, 1);
  });

  // --------------------------------------------------------------------------
  // Perbaikan UX: assign SPV Drop Point ke BANYAK DP sekaligus dari form User
  // (syncSupervisedDropPoints) - jalur KEDUA selain edit per-DP di halaman
  // Drop Point, keduanya nulis ke kolom yang SAMA jadi harus tetap sinkron.
  // --------------------------------------------------------------------------

  function spvOf(kodeDp: string): string | null {
    const row = store.get('master_drop_point')!.find((d) => d.kode_dp === kodeDp)!;
    return (row.spv_drop_point_user_id as string | null) ?? null;
  }

  it('28. syncSupervisedDropPoints: uncheck salah satu DP -> DP itu dilepas (null), DP lain tetap, DP milik SPV LAIN tak tersentuh', async () => {
    await dropPoints.syncSupervisedDropPoints(ADMIN_CABANG, SPV, ['BATANG01']);
    assert.equal(spvOf('BATANG01'), SPV_ID);
    assert.equal(spvOf('BANDAR01'), null, 'BANDAR01 harus dilepas krn tak lagi dipilih');
    assert.equal(spvOf('SUBAH01'), SPV_SATU_ID, 'milik SPV lain tidak boleh ikut berubah');
  });

  it('29. syncSupervisedDropPoints: assign DP yang sebelumnya milik SPV LAIN -> pindah kepemilikan (reassign), DP existing target tetap', async () => {
    await dropPoints.syncSupervisedDropPoints(ADMIN_CABANG, SPV, ['BATANG01', 'BANDAR01', 'SUBAH01']);
    assert.equal(spvOf('BATANG01'), SPV_ID);
    assert.equal(spvOf('BANDAR01'), SPV_ID);
    assert.equal(spvOf('SUBAH01'), SPV_ID, 'reassign dari SPV_SATU ke SPV');
  });

  it('30. syncSupervisedDropPoints: kirim array kosong -> SEMUA DP milik target dilepas', async () => {
    await dropPoints.syncSupervisedDropPoints(ADMIN_CABANG, SPV, []);
    assert.equal(spvOf('BATANG01'), null);
    assert.equal(spvOf('BANDAR01'), null);
  });

  it('31. syncSupervisedDropPoints: target BUKAN Jabatan "SPV Drop Point" -> VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => dropPoints.syncSupervisedDropPoints(ADMIN_CABANG, 'admindp@ltms.test', ['BATANG01']),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('32. syncSupervisedDropPoints: kode DP tidak ada -> VALIDATION_ERROR, TIDAK ADA perubahan (validasi dulu sebelum update apapun)', async () => {
    await assert.rejects(
      () => dropPoints.syncSupervisedDropPoints(ADMIN_CABANG, SPV, ['TIDAK-ADA']),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
    assert.equal(spvOf('BATANG01'), SPV_ID, 'assignment lama tak boleh ikut berubah krn request gagal');
    assert.equal(spvOf('BANDAR01'), SPV_ID);
  });

  it('33. syncSupervisedDropPoints: dipanggil Admin DP (bukan full access) -> FORBIDDEN', async () => {
    await assert.rejects(
      () => dropPoints.syncSupervisedDropPoints('admindp@ltms.test', SPV, ['BATANG01']),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  // --------------------------------------------------------------------------
  // Revisi (misdiagnosis dicabut): kolom "Sudah" di tabel Progress per Drop
  // Point HARUS tetap CUMULATIVE (all-time, sama spt "Sudah Feedback
  // Keseluruhan") - SENGAJA beda cakupan waktu dari gauge "Progress Hari
  // Ini" (activity_log hari ini) di atasnya, dua metrik berbeda tujuan
  // (coverage total vs kecepatan harian). Sempat "disamakan" ke hari ini
  // lalu dicabut setelah dikonfirmasi ke lapangan (BATANG01 278/278 adalah
  // coverage total, bukan kecepatan 1 hari). UI melabeli kolom ini
  // "Sudah (Total)" persis krn ini, lihat dashboard-client.tsx.
  // --------------------------------------------------------------------------

  it('34. getDashboard: monitoringDp[].sudah per DP HARUS cumulative (status feedback longtail SAAT INI), BUKAN scoped hari ini - independen dari activity_log', async () => {
    const rows = store.get('longtail')!;
    (rows.find((r) => r.no_waybill === 'WB-BATANG') as Row).feedback = 'On Delivery';
    (rows.find((r) => r.no_waybill === 'WB-BANDAR') as Row).feedback = 'On Delivery'; // cumulative feedback ada, TANPA activity_log hari ini sama sekali
    store.set('activity_log', []); // kosong - "Progress Hari Ini" harus 0, TAPI "Sudah (Total)" tetap reflect status cumulative

    const dash = await dashboard.getDashboard(ADMIN_CABANG);
    assert.equal(dash.summary.progressHariIni, 0, 'gauge Progress Hari Ini tetap independen - tak ada activity_log hari ini');
    assert.equal(dash.summary.sudahFeedback, 2, 'Sudah Feedback Keseluruhan (cumulative) tak berubah');
    assert.equal(dash.summary.total, 3);

    const byDp = Object.fromEntries(dash.monitoringDp.map((d) => [d.dp, d]));
    assert.equal(byDp['BATANG01'].sudah, 1, 'BATANG01: cumulative feedback sudah terisi -> sudah=1 WALAU tanpa activity_log hari ini');
    assert.equal(byDp['BANDAR01'].sudah, 1, 'BANDAR01: sama - cumulative, bukan hari ini');
    assert.equal(byDp['SUBAH01'].sudah, 0, 'SUBAH01: belum ada feedback sama sekali -> tetap 0');
    assert.equal(byDp['BATANG01'].progressPct, 100);
  });

  it('35. getDashboard: activity_log HARI SEBELUMNYA / hari ini TIDAK memengaruhi kolom Sudah per DP sama sekali (murni dari status feedback longtail, bukan dari activity_log)', async () => {
    const today = jakartaTodayIso();
    // Activity_log ADA hari ini utk WB-SUBAH, TAPI feedback longtail-nya sendiri masih kosong.
    store.set('activity_log', [
      { waybill: 'WB-SUBAH', user_email: ADMIN_CABANG, dp: 'SUBAH01', attempt_ke: 1, data_baru: '', sumber: 'Manual Feedback', created_at: `${today}T09:00:00+07:00` },
    ]);
    const dash = await dashboard.getDashboard(ADMIN_CABANG);
    const byDp = Object.fromEntries(dash.monitoringDp.map((d) => [d.dp, d]));
    assert.equal(byDp['SUBAH01'].sudah, 0, 'activity_log hari ini TIDAK membuat Sudah (Total) naik kalau feedback longtail-nya sendiri masih kosong');
  });

  it('36. getDashboard: sum kolom Sudah (Total) semua baris Progress per Drop Point = Sudah Feedback Keseluruhan (summary), TIDAK diharuskan sama dgn gauge Progress Hari Ini', async () => {
    const today = jakartaTodayIso();
    const rows = store.get('longtail')!;
    (rows.find((r) => r.no_waybill === 'WB-BATANG') as Row).feedback = 'On Delivery';
    store.set('activity_log', [
      { waybill: 'WB-BATANG', user_email: ADMIN_CABANG, dp: 'BATANG01', attempt_ke: 1, data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: `${today}T09:00:00+07:00` },
    ]);
    const dash = await dashboard.getDashboard(ADMIN_CABANG);
    const sumSudah = dash.monitoringDp.reduce((acc, d) => acc + d.sudah, 0);
    assert.equal(sumSudah, dash.summary.sudahFeedback, 'sum Sudah (Total) per DP harus sama dgn Sudah Feedback Keseluruhan (sama-sama cumulative)');
    assert.equal(dash.summary.progressHariIni, 1, 'gauge harian tetap dihitung terpisah, boleh beda angka dari sum di atas');
  });

  it('37. getDashboard: fetch activity_log hari ini (gauge Progress Hari Ini) tetap dipaginasi (>1000 baris) - defensive hardening, tak memengaruhi kolom Sudah (Total) per DP', async () => {
    const today = jakartaTodayIso();
    const longtailRows = store.get('longtail')!;
    const activityRows: Row[] = [];
    const PAGE = 1000;
    for (let i = 0; i < PAGE + 5; i++) {
      const wb = `WB-FILL-${i}`;
      longtailRows.push({ no_waybill: wb, status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'BANDAR01', waktu_sampai: '2026-07-27 09:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 });
      activityRows.push({ waybill: wb, user_email: ADMIN_CABANG, dp: 'BANDAR01', attempt_ke: 1, data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: `${today}T08:00:00+07:00` });
    }
    // Activity_log WB-BATANG SENGAJA ditaruh PALING TERAKHIR dlm urutan insert
    // supaya kalau query lupa dipaginasi (cuma ambil 1000 baris pertama), entry
    // ini yang pertama hilang dari gauge Progress Hari Ini.
    activityRows.push({ waybill: 'WB-BATANG', user_email: ADMIN_CABANG, dp: 'BATANG01', attempt_ke: 1, data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: `${today}T09:00:00+07:00` });
    store.set('activity_log', activityRows);

    const dash = await dashboard.getDashboard(ADMIN_CABANG);
    assert.equal(dash.summary.progressHariIni, PAGE + 6, 'gauge harus mencakup SEMUA baris activity_log hari ini, termasuk yg jatuh di luar 1000 baris pertama');

    const byDp = Object.fromEntries(dash.monitoringDp.map((d) => [d.dp, d]));
    assert.equal(byDp['BATANG01'].sudah, 0, 'Sudah (Total) per DP TETAP murni cumulative (feedback longtail WB-BATANG masih kosong) - tak terpengaruh volume activity_log hari ini');
  });
});
