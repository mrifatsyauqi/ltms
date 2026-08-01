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
  // Seed persis spt migrasi produksi: semua true utk kedua role (5 menu_key
  // sejak monitoring_delivery_dp ditambahkan - mode per-Sprinter Monitoring
  // Delivery, dipakai SPV Drop Point & Admin DP).
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

  it('2. hasPermission: Admin Cabang/Manager Kota/Asisten Manager Kota selalu true - TIDAK PERNAH masuk matrix (given dari Langkah 3), walau ada baris matrix yg bilang false utk "role" mereka', async () => {
    // Baris ini SEHARUSNYA mustahil di produksi (CHECK constraint DB menolak
    // role selain SPV Drop Point/Admin DP) - disimulasikan di sini justru utk
    // membuktikan kode TIDAK PERNAH membaca baris ini utk role full access,
    // bukan cuma "kebetulan" tidak ada baris yg mengembalikan false.
    store.set('role_permissions', [
      { role: 'Admin Cabang', menu_key: 'dashboard', enabled: false },
      { role: 'Manager Kota', menu_key: 'dashboard', enabled: false },
      { role: 'Asisten Manager Kota', menu_key: 'dashboard', enabled: false },
    ]);
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      const actor = await helpers.requireActor(email);
      for (const key of permissions.MENU_KEYS) {
        assert.equal(await permissions.hasPermission(actor, key), true, `${email} harus tetap true utk ${key}`);
      }
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

  it('12. REGRESI: Admin Cabang/Manager Kota/Asisten Manager Kota/Super Admin TIDAK TERPENGARUH SAMA SEKALI walau SEMUA baris role_permissions dimatikan (matrix cuma berlaku utk SPV DP/Admin DP)', async () => {
    for (const r of store.get('role_permissions')!) r.enabled = false;
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER, SUPER_ADMIN]) {
      const dash = await dashboard.getDashboard(email);
      assert.ok(dash, `${email} tetap bisa akses Dashboard`);
      const list = await longtail.listLongTail(email);
      assert.ok(Array.isArray(list), `${email} tetap bisa akses Feedback Long Tail (view)`);
      const log = await riwayat.listRiwayatFeedback(email);
      assert.ok(Array.isArray(log), `${email} tetap bisa akses Riwayat Feedback`);
    }
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
    // Baris ini mustahil di produksi (Admin Cabang tak masuk GATED_ROLES
    // sekarang, hasPermission-nya masih bypass) - disimulasikan justru utk
    // membuktikan monitoring_delivery_dp SPV/Admin DP membaca baris
    // role='SPV Drop Point'/'Admin DP' miliknya sendiri, bukan tercampur.
    store.get('role_permissions')!.push({ role: 'Admin Cabang', menu_key: 'monitoring_delivery_cabang', enabled: false });
    const admindp = await helpers.requireActor(ADMIN_DP);
    assert.equal(await permissions.hasPermission(admindp, 'monitoring_delivery_dp'), true);
  });
});
