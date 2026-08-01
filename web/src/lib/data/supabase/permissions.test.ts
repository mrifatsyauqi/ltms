// Role & Akses (matrix menu HANYA utk SPV Drop Point/Admin DP): hasPermission()
// murni + integrasi nyata ke endpoint (dashboard/feedback longtail view+edit/
// riwayat feedback) - mock.module() HANYA di boundary db() (client.ts), pola
// sama dgn role-expansion.test.ts. Checkpoint utama yg diminta: akun SPV
// dummy, matikan 1 menu (role default) -> FORBIDDEN, nyalakan lagi via
// override akun -> berhasil lagi.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

const SPV_ID = 'u-spv';
const ADMINDP_ID = 'u-admindp';

const FULL_ACCESS_MENU_KEYS = [
  'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
  'data_longtail', 'import_longtail',
  'monitoring_delivery_dp', 'monitoring_delivery_cabang',
  'master_cabang', 'master_drop_point', 'master_feedback', 'user_management',
  'riwayat_import', 'riwayat_feedback',
  'pengaturan', 'role_akses',
] as const;

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { id: 'u-admincabang', email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
    { id: 'u-manager', email: 'manager@ltms.test', nama: 'Manager Kota', role: 'Manager Kota', drop_point: '', status_aktif: true },
    { id: 'u-asisten', email: 'asisten@ltms.test', nama: 'Asisten Manager', role: 'Asisten Manager Kota', drop_point: '', status_aktif: true },
    { id: 'u-superadmin', email: 'superadmin@ltms.test', nama: 'Super Admin', role: 'Super Admin', drop_point: '', status_aktif: true },
    { id: SPV_ID, email: 'spv@ltms.test', nama: 'SPV Dummy', role: 'SPV Drop Point', drop_point: '', status_aktif: true },
    { id: ADMINDP_ID, email: 'admindp@ltms.test', nama: 'Admin DP', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
  ]);
  store.set('master_drop_point', [
    { kode_dp: 'BATANG01', nama_dp: 'Batang 01', wilayah: 'Batang', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
  ]);
  store.set('longtail', [
    { no_waybill: 'WB-BATANG', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'BATANG01', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
  ]);
  store.set('activity_log', []);
  store.set('cabang', []);
  store.set('master_feedback', []);
  store.set('jabatan', [
    { id: 'jab-super-admin', nama: 'Super Admin', tingkat: 1, deskripsi: null },
    { id: 'jab-admin-cabang', nama: 'Admin Cabang', tingkat: 2, deskripsi: null },
    { id: 'jab-manager-kota', nama: 'Manager Kota', tingkat: 3, deskripsi: null },
    { id: 'jab-asisten-manager', nama: 'Asisten Manager Kota', tingkat: 4, deskripsi: null },
    { id: 'jab-spv-dp', nama: 'SPV Drop Point', tingkat: 5, deskripsi: null },
    { id: 'jab-admin-dp', nama: 'Admin DP', tingkat: 6, deskripsi: null },
  ]);
  // Seed persis spt migrasi produksi: semua true utk SPV Drop Point/Admin DP
  // (5 menu_key) DAN Admin Cabang/Manager Kota/Asisten Manager Kota (15
  // menu_key, sejak bypass hasPermission() utk grup ini dihapus - role_
  // akses_hierarchy_migration.sql). Kalau seed ini TIDAK all-true, itulah
  // skenario "lockout" yang harus dicegah (lihat test 2/12 di bawah).
  store.set('role_permissions', [
    { role: 'SPV Drop Point', menu_key: 'dashboard', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'feedback_longtail_view', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'feedback_longtail_edit', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'riwayat_feedback', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'monitoring_delivery_dp', enabled: true },
    { role: 'Admin DP', menu_key: 'dashboard', enabled: true },
    { role: 'Admin DP', menu_key: 'feedback_longtail_view', enabled: true },
    { role: 'Admin DP', menu_key: 'feedback_longtail_edit', enabled: true },
    { role: 'Admin DP', menu_key: 'riwayat_feedback', enabled: true },
    { role: 'Admin DP', menu_key: 'monitoring_delivery_dp', enabled: true },
    ...(['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota'] as const).flatMap((role) =>
      FULL_ACCESS_MENU_KEYS.map((menu_key) => ({ role, menu_key, enabled: true })),
    ),
  ]);
  store.set('user_permissions', []);
  return store;
}

const ADMIN_CABANG = 'admincabang@ltms.test';
const MANAGER_KOTA = 'manager@ltms.test';
const ASISTEN_MANAGER = 'asisten@ltms.test';
const SUPER_ADMIN = 'superadmin@ltms.test';
const SPV = 'spv@ltms.test';
const ADMIN_DP = 'admindp@ltms.test';

describe('Role & Akses: hasPermission() + integrasi endpoint (eksekusi nyata, fungsi produksi asli)', () => {
  let helpers: typeof import('./helpers.ts');
  let permissions: typeof import('./permissions.ts');
  let dashboard: typeof import('./dashboard.ts');
  let longtail: typeof import('./longtail.ts');
  let riwayat: typeof import('./riwayat-feedback.ts');
  let importLib: typeof import('./import.ts');
  let cabangLib: typeof import('./cabang.ts');
  let dropPointsLib: typeof import('./drop-points.ts');
  let masterFeedbackLib: typeof import('./master-feedback.ts');
  let usersLib: typeof import('./users.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    helpers = await import('./helpers.ts');
    permissions = await import('./permissions.ts');
    dashboard = await import('./dashboard.ts');
    longtail = await import('./longtail.ts');
    riwayat = await import('./riwayat-feedback.ts');
    importLib = await import('./import.ts');
    cabangLib = await import('./cabang.ts');
    dropPointsLib = await import('./drop-points.ts');
    masterFeedbackLib = await import('./master-feedback.ts');
    usersLib = await import('./users.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('1. hasPermission: Super Admin selalu true, TIDAK PERNAH dicek ke matrix - walau role_permissions/user_permissions kosong sama sekali', async () => {
    store.set('role_permissions', []);
    store.set('user_permissions', []);
    const actor = await helpers.requireActor(SUPER_ADMIN);
    for (const key of permissions.MENU_KEYS) {
      assert.equal(await permissions.hasPermission(actor, key), true, `Super Admin harus true utk ${key} walau matrix kosong`);
    }
  });

  it('2. CHECKPOINT KRITIS (cegah lockout): hasPermission Admin Cabang/Manager Kota/Asisten Manager Kota -> TETAP true utk SEMUA menu_key dgn seed default (all-true) - bypass grup DIHAPUS, tapi krn seed default true, PERILAKU YANG TERAMATI TETAP SAMA PERSIS spt sebelum bypass dihapus (regresi nol utk akun produksi manapun yang belum di-nonaktifkan apa pun)', async () => {
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      const actor = await helpers.requireActor(email);
      for (const key of permissions.MENU_KEYS) {
        assert.equal(await permissions.hasPermission(actor, key), true, `${email} harus true utk ${key} (seed default)`);
      }
    }
  });

  it('2b. BUKTI bypass BENAR-BENAR dihapus (bukan cuma "kebetulan default true"): matikan 1 menu_key spesifik utk Admin Cabang/Manager Kota/Asisten Manager Kota -> hasPermission HARUS ikut false, menu lain TIDAK terpengaruh', async () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota']) {
      store.get('role_permissions')!.find((r) => r.role === role && r.menu_key === 'master_cabang')!.enabled = false;
    }
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      const actor = await helpers.requireActor(email);
      assert.equal(await permissions.hasPermission(actor, 'master_cabang'), false, `${email} harus false setelah menu_key ini dimatikan - membuktikan matrix BENAR-BENAR dicek, bukan bypass`);
      assert.equal(await permissions.hasPermission(actor, 'dashboard'), true, `${email} menu lain tak ikut terpengaruh`);
    }
  });

  it('2c. Super Admin TETAP satu-satunya bypass mutlak - TIDAK terpengaruh walau SEMUA baris role_permissions (termasuk miliknya sendiri, seharusnya mustahil di produksi krn CHECK constraint) dimatikan', async () => {
    for (const r of store.get('role_permissions')!) r.enabled = false;
    store.get('role_permissions')!.push({ role: 'Super Admin', menu_key: 'dashboard', enabled: false }); // mustahil di produksi (CHECK constraint), disimulasikan utk buktikan Super Admin tak pernah baca baris ini sama sekali
    const superAdmin = await helpers.requireActor(SUPER_ADMIN);
    for (const key of permissions.MENU_KEYS) {
      assert.equal(await permissions.hasPermission(superAdmin, key), true, `Super Admin harus tetap true utk ${key}`);
    }
  });

  it('3. hasPermission: SPV Drop Point/Admin DP ikuti default role_permissions kalau TIDAK ada override akun', async () => {
    const spv = await helpers.requireActor(SPV);
    const admindp = await helpers.requireActor(ADMIN_DP);
    for (const key of permissions.MENU_KEYS) {
      assert.equal(await permissions.hasPermission(spv, key), true);
      assert.equal(await permissions.hasPermission(admindp, key), true);
    }
  });

  it('4. hasPermission: default role dimatikan (enabled=false) -> actor role itu ikut false kalau tak ada override akun', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'riwayat_feedback')!.enabled = false;
    const spv = await helpers.requireActor(SPV);
    assert.equal(await permissions.hasPermission(spv, 'riwayat_feedback'), false);
    assert.equal(await permissions.hasPermission(spv, 'dashboard'), true, 'menu lain tak ikut terpengaruh');
  });

  it('5. hasPermission: override akun (user_permissions) MENANG atas default role, baik menyalakan maupun mematikan', async () => {
    store.set('user_permissions', [
      { user_id: SPV_ID, menu_key: 'dashboard', enabled: false }, // default true -> di-override jadi false
    ]);
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_edit')!.enabled = false;
    store.get('user_permissions')!.push({ user_id: SPV_ID, menu_key: 'feedback_longtail_edit', enabled: true }); // default false -> di-override jadi true

    const spv = await helpers.requireActor(SPV);
    assert.equal(await permissions.hasPermission(spv, 'dashboard'), false, 'override false menang atas default true');
    assert.equal(await permissions.hasPermission(spv, 'feedback_longtail_edit'), true, 'override true menang atas default false');
    assert.equal(await permissions.hasPermission(spv, 'riwayat_feedback'), true, 'menu tanpa override tetap ikut default');
  });

  it('6. hasPermission: role_permissions kosong sama sekali (jaring pengaman) -> default true, BUKAN false', async () => {
    store.set('role_permissions', []);
    const spv = await helpers.requireActor(SPV);
    assert.equal(await permissions.hasPermission(spv, 'dashboard'), true);
  });

  // --------------------------------------------------------------------------
  // Checkpoint yang diminta: akun SPV dummy, matikan 1 menu, verifikasi
  // TIDAK BISA akses (FORBIDDEN) lewat endpoint/fungsi produksi ASLI (bukan
  // cuma hasPermission() murni) - lalu nyalakan lagi via override akun,
  // verifikasi BISA akses lagi.
  // --------------------------------------------------------------------------

  it('7. CHECKPOINT: SPV dummy - matikan feedback_longtail_edit (default role) -> submitFeedback FORBIDDEN', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_edit')!.enabled = false;
    await assert.rejects(
      () => longtail.submitFeedback(SPV, 'WB-BATANG', 'On Delivery'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('8. CHECKPOINT: ...lalu nyalakan lagi KHUSUS akun ini via override user_permissions -> submitFeedback berhasil lagi (default role tetap false, tidak ikut berubah)', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_edit')!.enabled = false;
    store.get('user_permissions')!.push({ user_id: SPV_ID, menu_key: 'feedback_longtail_edit', enabled: true });

    const result = await longtail.submitFeedback(SPV, 'WB-BATANG', 'On Delivery via override');
    assert.equal(result.Feedback, 'On Delivery via override');

    // Default role utk SPV LAIN (tanpa override akun) tetap FORBIDDEN - override
    // cuma berlaku per akun, tidak ikut menaikkan default role-nya.
    store.get('users')!.push({ id: 'u-spv-lain', email: 'spvlain@ltms.test', nama: 'SPV Lain', role: 'SPV Drop Point', drop_point: '', status_aktif: true });
    store.get('master_drop_point')!.push({ kode_dp: 'BANDAR01', nama_dp: 'Bandar 01', wilayah: 'Bandar', status_aktif: true, kode_kota: null, spv_drop_point_user_id: 'u-spv-lain' });
    store.get('longtail')!.push({ no_waybill: 'WB-BANDAR', status_terakhir: 'KIRIM', alasan_bermasalah: '', dp_sampai: 'BANDAR01', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null, sprinter_delivery: '', cod: 'NONCOD', delivery_attempt: 0, feedback: '', log_feedback: '', perlu_review: false, version: 1 });
    await assert.rejects(
      () => longtail.submitFeedback('spvlain@ltms.test', 'WB-BANDAR', 'On Delivery'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('9. getDashboard: menu "dashboard" dimatikan utk Admin DP -> FORBIDDEN', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin DP' && r.menu_key === 'dashboard')!.enabled = false;
    await assert.rejects(
      () => dashboard.getDashboard(ADMIN_DP),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('10. listLongTail/getLongTail: menu "feedback_longtail_view" dimatikan -> FORBIDDEN utk keduanya, TAPI submitFeedback (edit) tetap jalan (menu beda)', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_view')!.enabled = false;
    await assert.rejects(
      () => longtail.listLongTail(SPV),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
    await assert.rejects(
      () => longtail.getLongTail(SPV, 'WB-BATANG'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
    const ok = await longtail.submitFeedback(SPV, 'WB-BATANG', 'On Delivery');
    assert.equal(ok.Feedback, 'On Delivery', 'feedback_longtail_edit tak ikut terpengaruh matinya feedback_longtail_view');
  });

  it('11. listRiwayatFeedback: menu "riwayat_feedback" dimatikan -> FORBIDDEN', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin DP' && r.menu_key === 'riwayat_feedback')!.enabled = false;
    await assert.rejects(
      () => riwayat.listRiwayatFeedback(ADMIN_DP),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('12. CHECKPOINT KRITIS (endpoint nyata, bukan cuma hasPermission murni): dgn seed default (all-true), Admin Cabang/Manager Kota/Asisten Manager Kota TETAP BISA akses Dashboard/Feedback Long Tail/Riwayat Feedback via fungsi produksi asli - regresi nol', async () => {
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      const dash = await dashboard.getDashboard(email);
      assert.ok(dash, `${email} tetap bisa akses Dashboard`);
      const list = await longtail.listLongTail(email);
      assert.ok(Array.isArray(list), `${email} tetap bisa akses Feedback Long Tail (view)`);
      const log = await riwayat.listRiwayatFeedback(email);
      assert.ok(Array.isArray(log), `${email} tetap bisa akses Riwayat Feedback`);
    }
  });

  it('12b. BUKTI endpoint nyata BENAR-BENAR menegakkan matrix skrg (bukan cuma hasPermission murni): matikan "dashboard" utk Admin Cabang/Manager Kota/Asisten Manager Kota -> getDashboard FORBIDDEN, TAPI Feedback Long Tail/Riwayat Feedback (menu_key beda) tetap jalan', async () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota']) {
      store.get('role_permissions')!.find((r) => r.role === role && r.menu_key === 'dashboard')!.enabled = false;
    }
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      await assert.rejects(
        () => dashboard.getDashboard(email),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
        `${email} harus FORBIDDEN setelah menu dashboard dimatikan`,
      );
      const list = await longtail.listLongTail(email);
      assert.ok(Array.isArray(list), `${email} Feedback Long Tail (menu_key beda) tak ikut terblokir`);
    }
  });

  it('12c. Super Admin TETAP TIDAK TERPENGARUH SAMA SEKALI lewat endpoint nyata walau SEMUA baris role_permissions dimatikan', async () => {
    for (const r of store.get('role_permissions')!) r.enabled = false;
    const dash = await dashboard.getDashboard(SUPER_ADMIN);
    assert.ok(dash, 'Super Admin tetap bisa akses Dashboard');
    const list = await longtail.listLongTail(SUPER_ADMIN);
    assert.ok(Array.isArray(list), 'Super Admin tetap bisa akses Feedback Long Tail (view)');
    const log = await riwayat.listRiwayatFeedback(SUPER_ADMIN);
    assert.ok(Array.isArray(log), 'Super Admin tetap bisa akses Riwayat Feedback');
  });

  // --------------------------------------------------------------------------
  // Fix bug: Sidebar menampilkan menu yang menu_key-nya sudah dimatikan
  // (cuma isinya yg diblokir backend, itemnya sendiri tetap kelihatan &
  // bisa diklik). getEffectiveMenuAccess()/getMyMenuAccess() HARUS pakai
  // resolusi PERSIS SAMA dgn hasPermission() (fetchGatedPermissionMap
  // dibagi bersama) supaya sidebar & backend tak pernah beda pendapat.
  // --------------------------------------------------------------------------

  it('13. getEffectiveMenuAccess: full access (termasuk Super Admin) -> SEMUA 15 menu_key true TANPA butuh baris matrix sama sekali', async () => {
    store.set('role_permissions', []);
    store.set('user_permissions', []);
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER, SUPER_ADMIN]) {
      const actor = await helpers.requireActor(email);
      const access = await permissions.getEffectiveMenuAccess(actor);
      assert.deepEqual(access, Object.fromEntries(permissions.MENU_KEYS.map((k) => [k, true])));
    }
  });

  it('14. getEffectiveMenuAccess: SPV Drop Point - hasil PERSIS SAMA dgn hasPermission() per menu_key, termasuk campuran default+override', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_view')!.enabled = false;
    store.get('user_permissions')!.push({ user_id: SPV_ID, menu_key: 'riwayat_feedback', enabled: false });

    const spv = await helpers.requireActor(SPV);
    const access = await permissions.getEffectiveMenuAccess(spv);
    for (const key of permissions.MENU_KEYS) {
      assert.equal(access[key], await permissions.hasPermission(spv, key), `access.${key} harus sinkron dgn hasPermission(spv, '${key}')`);
    }
    assert.equal(access.feedback_longtail_view, false, 'default role dimatikan');
    assert.equal(access.riwayat_feedback, false, 'override akun dimatikan');
    assert.equal(access.dashboard, true, 'menu lain tak ikut terpengaruh');
  });

  it('15. CHECKPOINT bug sidebar: getMyMenuAccess(SPV) - matikan Feedback Long Tail (Lihat) -> feedback_longtail_view=false (menu HARUS hilang dari sidebar), lalu nyalakan lagi -> true (muncul lagi)', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_view')!.enabled = false;
    const offAccess = await permissions.getMyMenuAccess(SPV);
    assert.equal(offAccess.feedback_longtail_view, false, 'sidebar HARUS menyembunyikan item Feedback Long Tail, bukan cuma isinya diblokir');

    store.get('role_permissions')!.find((r) => r.role === 'SPV Drop Point' && r.menu_key === 'feedback_longtail_view')!.enabled = true;
    const onAccess = await permissions.getMyMenuAccess(SPV);
    assert.equal(onAccess.feedback_longtail_view, true, 'dinyalakan lagi -> item harus muncul kembali di sidebar');
  });

  it('16. getMyMenuAccess: role di luar 6 yang dikenal (data korup, seharusnya mustahil krn CHECK constraint) -> semua menu false, bukan throw', async () => {
    store.get('users')!.push({ id: 'u-aneh', email: 'aneh@ltms.test', nama: 'Role Aneh', role: 'Role Tidak Dikenal', drop_point: '', status_aktif: true });
    const access = await permissions.getMyMenuAccess('aneh@ltms.test');
    assert.ok(Object.values(access).every((v) => v === false));
  });

  // --------------------------------------------------------------------------
  // Wiring Monitoring Delivery: 'monitoring_delivery_dp' (mode per-Sprinter)
  // dipasangkan ke SPV Drop Point & Admin DP - menu_key BARU yang sebelumnya
  // tak ada di seed 4-menu_key original mereka. REGRESI KRITIS: Admin DP
  // existing (sudah lama pakai fitur ini) TIDAK BOLEH terputus - seed true.
  // --------------------------------------------------------------------------

  it("17. REGRESI KRITIS: hasPermission Admin DP & SPV Drop Point utk 'monitoring_delivery_dp' -> true by default (seed), TIDAK terputus", async () => {
    const admindp = await helpers.requireActor(ADMIN_DP);
    const spv = await helpers.requireActor(SPV);
    assert.equal(await permissions.hasPermission(admindp, 'monitoring_delivery_dp'), true, 'Admin DP existing tak boleh terputus');
    assert.equal(await permissions.hasPermission(spv, 'monitoring_delivery_dp'), true);
  });

  it("18. CHECKPOINT: matikan 'monitoring_delivery_dp' utk Admin DP -> getMyMenuAccess false (page akan blokir & sidebar akan sembunyikan), menu lain tak ikut terpengaruh", async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin DP' && r.menu_key === 'monitoring_delivery_dp')!.enabled = false;
    const access = await permissions.getMyMenuAccess(ADMIN_DP);
    assert.equal(access.monitoring_delivery_dp, false);
    assert.equal(access.dashboard, true, 'menu lain tak ikut terpengaruh');
  });

  it("19. 'monitoring_delivery_cabang' (mode Refine Total, milik Admin Cabang dkk) TIDAK memengaruhi 'monitoring_delivery_dp' SPV Drop Point/Admin DP - 2 menu_key independen walau 1 fitur", async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin Cabang' && r.menu_key === 'monitoring_delivery_cabang')!.enabled = false;
    const admindp = await helpers.requireActor(ADMIN_DP);
    assert.equal(await permissions.hasPermission(admindp, 'monitoring_delivery_dp'), true, 'menu_key role lain tak ikut mempengaruhi');
  });

  // --------------------------------------------------------------------------
  // Wiring Monitoring Delivery utk Admin Cabang/Manager Kota/Asisten Manager
  // Kota (monitoring_delivery_cabang) SEKARANG BENAR-BENAR AKTIF sejak
  // bypass hasPermission() dihapus - sebelumnya no-op (selalu true krn
  // bypass grup, terlepas dari isi role_permissions).
  // --------------------------------------------------------------------------

  it("20. CHECKPOINT: matikan 'monitoring_delivery_cabang' utk Admin Cabang -> getMyMenuAccess false (SEKARANG BENAR-BENAR aktif, sebelumnya no-op krn bypass) - matikan lagi utk Manager Kota/Asisten Manager Kota independen per role", async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin Cabang' && r.menu_key === 'monitoring_delivery_cabang')!.enabled = false;
    const accessCabang = await permissions.getMyMenuAccess(ADMIN_CABANG);
    assert.equal(accessCabang.monitoring_delivery_cabang, false);

    const accessManager = await permissions.getMyMenuAccess(MANAGER_KOTA);
    assert.equal(accessManager.monitoring_delivery_cabang, true, 'Manager Kota tak ikut terpengaruh - matinya Admin Cabang independen per role');
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 3: 'import_longtail' SEKARANG ditegakkan nyata di importLongTail()
  // (import.ts), lapisan TAMBAHAN di atas requireRole(FULL_ACCESS_ROLES) yang
  // sudah ada sebelumnya (SPV/Admin DP TETAP tertolak walau import_longtail
  // mereka somehow true - dibuktikan test 21c). 'data_longtail'/'riwayat_import'
  // sengaja TIDAK punya test endpoint di sini - keduanya page-level SAJA
  // (tak ada requirePermission() di data-layer manapun utk keduanya), lihat
  // nav.test.ts utk cakupan sidebar-nya.
  // --------------------------------------------------------------------------

  it('21. CHECKPOINT KRITIS (endpoint nyata): dgn seed default (all-true), Admin Cabang/Manager Kota/Asisten Manager Kota TETAP BISA importLongTail() - regresi nol', async () => {
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      const result = await importLib.importLongTail(email, 'tarikan.xlsx', [
        { noWaybill: 'WB-BATANG', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' },
      ]);
      assert.ok(result, `${email} tetap bisa import`);
    }
  });

  it('21b. BUKTI import_longtail BENAR-BENAR menegakkan matrix (lapisan TAMBAHAN, bukan pengganti requireRole): matikan utk Admin Cabang -> importLongTail FORBIDDEN, TAPI Dashboard (menu_key beda) tetap jalan; Manager Kota tak ikut terpengaruh', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin Cabang' && r.menu_key === 'import_longtail')!.enabled = false;

    await assert.rejects(
      () => importLib.importLongTail(ADMIN_CABANG, 'tarikan.xlsx', [{ noWaybill: 'WB-BATANG', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' }]),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
      'Admin Cabang harus FORBIDDEN setelah import_longtail dimatikan',
    );
    const dash = await dashboard.getDashboard(ADMIN_CABANG);
    assert.ok(dash, 'Dashboard (menu_key beda) tak ikut terblokir');

    const resultManager = await importLib.importLongTail(MANAGER_KOTA, 'tarikan.xlsx', [
      { noWaybill: 'WB-BATANG', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' },
    ]);
    assert.ok(resultManager, 'Manager Kota tak ikut terpengaruh - matinya Admin Cabang independen per akun/role');
  });

  it('21c. REGRESI: SPV Drop Point/Admin DP TETAP tertolak importLongTail() walau import_longtail mereka somehow true (requireRole(FULL_ACCESS_ROLES) yang lama tetap jadi penjaga utama, bukan digantikan)', async () => {
    for (const role of ['SPV Drop Point', 'Admin DP'] as const) {
      store.get('role_permissions')!.push({ role, menu_key: 'import_longtail', enabled: true });
    }
    for (const email of [SPV, ADMIN_DP]) {
      await assert.rejects(
        () => importLib.importLongTail(email, 'tarikan.xlsx', [{ noWaybill: 'WB-BATANG', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' }]),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
        `${email}: import_longtail=true TIDAK BOLEH membocorkan akses - requireRole(FULL_ACCESS_ROLES) tetap harus menolak duluan`,
      );
    }
  });

  it('21d. Super Admin TETAP TIDAK TERPENGARUH lewat importLongTail() walau SEMUA baris role_permissions dimatikan', async () => {
    for (const r of store.get('role_permissions')!) r.enabled = false;
    const result = await importLib.importLongTail(SUPER_ADMIN, 'tarikan.xlsx', [
      { noWaybill: 'WB-BATANG', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' },
    ]);
    assert.ok(result, 'Super Admin tetap bisa import');
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 4: 4 menu_key Master Data ('master_cabang', 'master_drop_point',
  // 'master_feedback', 'user_management') SEKARANG ditegakkan nyata di fungsi
  // TULIS (create/update/delete) - listCabang/listDropPoints/listMasterFeedback/
  // listUsers SENGAJA TIDAK disentuh (dipakai bersama dropdown di halaman
  // lain, lihat komentar di masing2 file produksi).
  // --------------------------------------------------------------------------

  let dpCounter = 0;
  /** kodeDp unik per panggilan - createDropPoint cek konflik by kode. */
  function dp() { return `DPTEST${++dpCounter}`; }

  it('22. CHECKPOINT KRITIS (endpoint nyata): dgn seed default (all-true), Admin Cabang/Manager Kota/Asisten Manager Kota TETAP BISA createCabang/createDropPoint/createMasterFeedback/createUser - regresi nol', async () => {
    let n = 0;
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      n++;
      const cabang = await cabangLib.createCabang(email, { kodeKota: `KOTA-A-${n}`, namaKota: 'Kota Test' });
      assert.ok(cabang, `${email} tetap bisa createCabang`);
      const dropPoint = await dropPointsLib.createDropPoint(email, { kodeDp: dp(), namaDp: 'DP Test' });
      assert.ok(dropPoint, `${email} tetap bisa createDropPoint`);
      const feedback = await masterFeedbackLib.createMasterFeedback(email, `Feedback Test ${n}`);
      assert.ok(feedback, `${email} tetap bisa createMasterFeedback`);
      const user = await usersLib.createUser(email, { nama: 'User Baru', email: `usertest${n}@ltms.test`, nik: `NIK-UT-${n}`, role: 'Admin DP', dropPoint: 'BATANG01' });
      assert.ok(user, `${email} tetap bisa createUser`);
    }
  });

  it('22b. BUKTI 4 menu_key Master Data BENAR-BENAR menegakkan matrix, MASING2 INDEPENDEN: matikan 1 menu_key utk Admin Cabang -> fungsi terkait FORBIDDEN, 3 fungsi lain (menu_key beda) TETAP jalan, Manager Kota (role lain) TETAP tak terpengaruh', async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin Cabang' && r.menu_key === 'master_cabang')!.enabled = false;

    await assert.rejects(
      () => cabangLib.createCabang(ADMIN_CABANG, { kodeKota: 'KOTA-B', namaKota: 'Kota Test' }),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
      'Admin Cabang harus FORBIDDEN setelah master_cabang dimatikan',
    );
    const dropPoint = await dropPointsLib.createDropPoint(ADMIN_CABANG, { kodeDp: dp(), namaDp: 'DP Test' });
    assert.ok(dropPoint, 'createDropPoint (menu_key beda) tak ikut terblokir');
    const feedback = await masterFeedbackLib.createMasterFeedback(ADMIN_CABANG, 'Feedback Independen');
    assert.ok(feedback, 'createMasterFeedback (menu_key beda) tak ikut terblokir');
    const user = await usersLib.createUser(ADMIN_CABANG, { nama: 'User Independen', email: 'userindependen@ltms.test', nik: 'NIK-UI', role: 'Admin DP', dropPoint: 'BATANG01' });
    assert.ok(user, 'createUser (menu_key beda) tak ikut terblokir');

    const cabangManager = await cabangLib.createCabang(MANAGER_KOTA, { kodeKota: 'KOTA-C', namaKota: 'Kota Test' });
    assert.ok(cabangManager, 'Manager Kota tak ikut terpengaruh - matinya Admin Cabang independen per akun/role');
  });

  it('22c. REGRESI: SPV Drop Point/Admin DP TETAP tertolak createCabang/createDropPoint/createMasterFeedback/createUser walau menu_key-nya somehow true (requireRole(FULL_ACCESS_ROLES) yang lama tetap penjaga utama, bukan digantikan)', async () => {
    for (const role of ['SPV Drop Point', 'Admin DP'] as const) {
      for (const menu_key of ['master_cabang', 'master_drop_point', 'master_feedback', 'user_management'] as const) {
        store.get('role_permissions')!.push({ role, menu_key, enabled: true });
      }
    }
    for (const email of [SPV, ADMIN_DP]) {
      await assert.rejects(() => cabangLib.createCabang(email, { kodeKota: 'KOTA-D', namaKota: 'Kota Test' }),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN', `${email}: createCabang tak boleh bocor`);
      await assert.rejects(() => dropPointsLib.createDropPoint(email, { kodeDp: dp(), namaDp: 'DP Test' }),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN', `${email}: createDropPoint tak boleh bocor`);
      await assert.rejects(() => masterFeedbackLib.createMasterFeedback(email, 'Feedback Bocor'),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN', `${email}: createMasterFeedback tak boleh bocor`);
      await assert.rejects(() => usersLib.createUser(email, { nama: 'User Bocor', email: 'userbocor@ltms.test', nik: 'NIK-UB', role: 'Admin DP', dropPoint: 'BATANG01' }),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN', `${email}: createUser tak boleh bocor`);
    }
  });

  it('22d. Super Admin TETAP TIDAK TERPENGARUH lewat createCabang/createDropPoint/createMasterFeedback/createUser walau SEMUA baris role_permissions dimatikan', async () => {
    for (const r of store.get('role_permissions')!) r.enabled = false;
    const cabang = await cabangLib.createCabang(SUPER_ADMIN, { kodeKota: 'KOTA-E', namaKota: 'Kota Test' });
    assert.ok(cabang, 'Super Admin tetap bisa createCabang');
    const dropPoint = await dropPointsLib.createDropPoint(SUPER_ADMIN, { kodeDp: dp(), namaDp: 'DP Test' });
    assert.ok(dropPoint, 'Super Admin tetap bisa createDropPoint');
    const feedback = await masterFeedbackLib.createMasterFeedback(SUPER_ADMIN, 'Feedback Super Admin');
    assert.ok(feedback, 'Super Admin tetap bisa createMasterFeedback');
    const user = await usersLib.createUser(SUPER_ADMIN, { nama: 'User Super Admin', email: 'usersuperadmin@ltms.test', nik: 'NIK-USA', role: 'Admin DP', dropPoint: 'BATANG01' });
    assert.ok(user, 'Super Admin tetap bisa createUser');
  });
});
