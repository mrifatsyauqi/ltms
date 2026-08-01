// Role & Akses UI backend: listRoleAksesSummary/listAccountsByRole (grid +
// daftar akun), getRoleDefaultPermissions/setRoleDefaultPermission (mode
// "Per Role"), getAccountPermissions/setUserPermissionOverride/
// resetUserPermissionOverride (mode "Per Akun", toggle+Custom+Reset).
// mock.module() HANYA di boundary db(), fungsi produksi asli - pola sama
// dgn role-expansion.test.ts/permissions.test.ts.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

const SPV_ID = 'u-spv';
const SPV2_ID = 'u-spv2';
const ADMINDP_ID = 'u-admindp';
const MANAGER_ID = 'u-manager';
const ASISTEN_ID = 'u-asisten';

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
    { id: 'u-admincabang', email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', nik: '1000000001', status_aktif: true },
    { id: 'u-superadmin', email: 'superadmin@ltms.test', nama: 'Super Admin', role: 'Super Admin', drop_point: '', nik: '1000000002', status_aktif: true },
    { id: MANAGER_ID, email: 'manager@ltms.test', nama: 'Manager Kota', role: 'Manager Kota', drop_point: '', nik: '3324010', status_aktif: true },
    { id: ASISTEN_ID, email: 'asisten@ltms.test', nama: 'Asisten Manager', role: 'Asisten Manager Kota', drop_point: '', nik: '3324011', status_aktif: true },
    { id: 'u-admindp2', email: 'admindp2@ltms.test', nama: 'Admin DP Lain', role: 'Admin DP', drop_point: '', nik: '', status_aktif: true },
    { id: SPV_ID, email: 'spv@ltms.test', nama: 'Ahmad Fauzi', role: 'SPV Drop Point', drop_point: '', nik: '3324001', status_aktif: true },
    { id: SPV2_ID, email: 'spv2@ltms.test', nama: 'Budi Santoso', role: 'SPV Drop Point', drop_point: '', nik: '3324002', status_aktif: true },
    { id: ADMINDP_ID, email: 'admindp@ltms.test', nama: 'Citra Admin DP', role: 'Admin DP', drop_point: 'BATANG01', nik: '3324003', status_aktif: true },
  ]);
  store.set('master_drop_point', [
    { kode_dp: 'BATANG01', nama_dp: 'Batang 01', wilayah: 'Batang', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
    { kode_dp: 'BANDAR01', nama_dp: 'Bandar 01', wilayah: 'Bandar', status_aktif: true, kode_kota: null, spv_drop_point_user_id: SPV_ID },
    { kode_dp: 'SUBAH01', nama_dp: 'Subah 01', wilayah: 'Subah', status_aktif: true, kode_kota: null, spv_drop_point_user_id: null },
  ]);
  store.set('cabang', [
    { kode_kota: 'BATANG', nama_kota: 'Batang', manager_kota_user_id: MANAGER_ID, asisten_manager_user_id: null },
  ]);
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
const SUPER_ADMIN = 'superadmin@ltms.test';
const MANAGER_KOTA = 'manager@ltms.test';
const ASISTEN_MANAGER = 'asisten@ltms.test';
const ADMIN_DP_LAIN = 'admindp2@ltms.test';
const SPV = 'spv@ltms.test';

describe('Role & Akses (UI backend): summary/accounts/per-role/per-akun (eksekusi nyata, fungsi produksi asli)', () => {
  let helpers: typeof import('./helpers.ts');
  let roleAkses: typeof import('./role-akses.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    helpers = await import('./helpers.ts');
    roleAkses = await import('./role-akses.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('1. listRoleAksesSummary: HANYA 2 role (SPV Drop Point, Admin DP), jumlah akun benar', async () => {
    const summary = await roleAkses.listRoleAksesSummary(ADMIN_CABANG);
    assert.deepEqual(
      summary.sort((a, b) => a.role.localeCompare(b.role)),
      [
        { role: 'Admin DP', count: 2 },
        { role: 'SPV Drop Point', count: 2 },
      ],
    );
  });

  it('2. listRoleAksesSummary: DITOLAK (FORBIDDEN) kalau dipanggil actor bukan full access (mis. Admin DP sendiri)', async () => {
    await assert.rejects(
      () => roleAkses.listRoleAksesSummary(ADMIN_DP_LAIN),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('3. listAccountsByRole: SPV Drop Point - konteks "Supervisi N Drop Point" benar, badge customCount 0 kalau belum ada override', async () => {
    const accounts = await roleAkses.listAccountsByRole(ADMIN_CABANG, 'SPV Drop Point');
    const ahmad = accounts.find((a) => a.email === SPV)!;
    assert.equal(ahmad.konteks, 'Supervisi 2 Drop Point');
    assert.equal(ahmad.customCount, 0);
    const budi = accounts.find((a) => a.email === 'spv2@ltms.test')!;
    assert.equal(budi.konteks, 'Supervisi 0 Drop Point');
  });

  it('4. listAccountsByRole: Admin DP - konteks "Drop Point <kode>" (atau belum di-assign)', async () => {
    const accounts = await roleAkses.listAccountsByRole(ADMIN_CABANG, 'Admin DP');
    const citra = accounts.find((a) => a.email === 'admindp@ltms.test')!;
    assert.equal(citra.konteks, 'Drop Point BATANG01');
    const lain = accounts.find((a) => a.email === ADMIN_DP_LAIN)!;
    assert.equal(lain.konteks, 'Drop Point (belum di-assign)');
  });

  it('5. listAccountsByRole: role di luar SPV Drop Point/Admin DP -> VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => roleAkses.listAccountsByRole(ADMIN_CABANG, 'Admin Cabang'),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('6. getRoleDefaultPermissions: 5 baris lengkap sesuai seed (semua true) - PERSIS yang ada di DB utk role itu, bukan disintesis dari daftar menu_key global (15)', async () => {
    const rows = await roleAkses.getRoleDefaultPermissions(ADMIN_CABANG, 'SPV Drop Point');
    assert.equal(rows.length, 5);
    assert.ok(rows.every((r) => r.enabled === true));
    assert.ok(rows.some((r) => r.menuKey === 'monitoring_delivery_dp'));
  });

  it('7. setRoleDefaultPermission (mode Per Role): matikan 1 menu -> berlaku ke SEMUA akun role itu yang TAK punya override, tapi role LAIN tak ikut berubah', async () => {
    await roleAkses.setRoleDefaultPermission(ADMIN_CABANG, 'SPV Drop Point', 'riwayat_feedback', false);
    const spvRows = await roleAkses.getRoleDefaultPermissions(ADMIN_CABANG, 'SPV Drop Point');
    assert.equal(spvRows.find((r) => r.menuKey === 'riwayat_feedback')!.enabled, false);
    const admindpRows = await roleAkses.getRoleDefaultPermissions(ADMIN_CABANG, 'Admin DP');
    assert.equal(admindpRows.find((r) => r.menuKey === 'riwayat_feedback')!.enabled, true, 'Admin DP tak ikut terpengaruh');

    const spvDetail = await roleAkses.getAccountPermissions(ADMIN_CABANG, SPV_ID);
    assert.equal(spvDetail.permissions.find((p) => p.menuKey === 'riwayat_feedback')!.enabled, false);
    assert.equal(spvDetail.permissions.find((p) => p.menuKey === 'riwayat_feedback')!.isOverride, false, 'ikut default, BUKAN override akun');
  });

  it('8. setRoleDefaultPermission dipanggil DUA KALI (ubah lagi) -> tetap 5 baris (upsert, bukan duplikat) - regresi utk perbaikan FakeQuery composite onConflict', async () => {
    await roleAkses.setRoleDefaultPermission(ADMIN_CABANG, 'SPV Drop Point', 'dashboard', false);
    await roleAkses.setRoleDefaultPermission(ADMIN_CABANG, 'SPV Drop Point', 'dashboard', true);
    const rows = await roleAkses.getRoleDefaultPermissions(ADMIN_CABANG, 'SPV Drop Point');
    assert.equal(rows.length, 5, 'harus tetap 5 baris, bukan bertambah jadi duplikat');
    assert.equal(rows.find((r) => r.menuKey === 'dashboard')!.enabled, true);
  });

  it('9. getAccountPermissions: akun tanpa override -> semua isOverride=false, ikut default role (5 baris, termasuk monitoring_delivery_dp)', async () => {
    const detail = await roleAkses.getAccountPermissions(ADMIN_CABANG, SPV_ID);
    assert.equal(detail.nama, 'Ahmad Fauzi');
    assert.equal(detail.customCount, 0);
    assert.equal(detail.permissions.length, 5);
    assert.ok(detail.permissions.every((p) => p.isOverride === false && p.enabled === true));
    assert.ok(detail.permissions.some((p) => p.menuKey === 'monitoring_delivery_dp'));
  });

  it('10. setUserPermissionOverride: override 1 menu KHUSUS 1 akun - akun lain (termasuk role sama) TAK ikut berubah', async () => {
    const detail = await roleAkses.setUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'feedback_longtail_edit', false);
    const edit = detail.permissions.find((p) => p.menuKey === 'feedback_longtail_edit')!;
    assert.equal(edit.enabled, false);
    assert.equal(edit.isOverride, true);
    assert.equal(detail.customCount, 1);

    const other = await roleAkses.getAccountPermissions(ADMIN_CABANG, SPV2_ID);
    assert.equal(other.permissions.find((p) => p.menuKey === 'feedback_longtail_edit')!.enabled, true, 'akun lain harus tetap default (true)');
    assert.equal(other.customCount, 0);
  });

  it('11. setUserPermissionOverride dipanggil DUA KALI utk menu yang sama (ubah lagi) -> tetap 1 baris override (upsert), bukan duplikat', async () => {
    await roleAkses.setUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'dashboard', false);
    const detail = await roleAkses.setUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'dashboard', true);
    assert.equal(detail.customCount, 1, 'harus tetap 1 baris override utk menu itu, bukan 2');
    assert.equal(detail.permissions.find((p) => p.menuKey === 'dashboard')!.enabled, true);
  });

  it('12. resetUserPermissionOverride ("Reset ke Default"): hapus override 1 menu -> akun kembali ikut default role, menu LAIN yg sudah di-override tetap', async () => {
    await roleAkses.setUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'dashboard', false);
    await roleAkses.setUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'riwayat_feedback', false);

    const afterReset = await roleAkses.resetUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'dashboard');
    assert.equal(afterReset.permissions.find((p) => p.menuKey === 'dashboard')!.isOverride, false);
    assert.equal(afterReset.permissions.find((p) => p.menuKey === 'dashboard')!.enabled, true, 'kembali ke default role (true)');
    assert.equal(afterReset.permissions.find((p) => p.menuKey === 'riwayat_feedback')!.isOverride, true, 'override menu lain TIDAK ikut terhapus');
    assert.equal(afterReset.customCount, 1);
  });

  it('13. setUserPermissionOverride/resetUserPermissionOverride: target akun BUKAN SPV Drop Point/Admin DP (mis. Admin Cabang) -> VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => roleAkses.setUserPermissionOverride(ADMIN_CABANG, 'u-admincabang', 'dashboard', false),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('14. DITOLAK (FORBIDDEN) kalau dipanggil actor SPV Drop Point/Admin DP sendiri - mereka DIATUR, bukan mengatur (baik Per Role maupun Per Akun)', async () => {
    await assert.rejects(
      () => roleAkses.setRoleDefaultPermission(SPV, 'SPV Drop Point', 'dashboard', false),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
    await assert.rejects(
      () => roleAkses.setUserPermissionOverride(SPV, SPV2_ID, 'dashboard', false),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
    await assert.rejects(
      () => roleAkses.getAccountPermissions(SPV, SPV_ID),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
      'SPV tak boleh lihat izin akun manapun sekalipun dirinya sendiri - halaman ini cuma utk yg mengatur',
    );
  });

  // --------------------------------------------------------------------------
  // Perluasan hierarki: Super Admin bisa atur SEMUA 5 role (termasuk Admin
  // Cabang/Manager Kota/Asisten Manager Kota) - Admin Cabang/Manager
  // Kota/Asisten Manager Kota SENDIRI TETAP HANYA bisa atur SPV Drop
  // Point/Admin DP (tidak berubah), TIDAK BISA atur kartu role mereka
  // sendiri (privilese eksklusif Super Admin).
  // --------------------------------------------------------------------------

  it('15. listRoleAksesSummary: Super Admin -> 5 kartu (Admin Cabang/Manager Kota/Asisten Manager Kota/SPV Drop Point/Admin DP)', async () => {
    const summary = await roleAkses.listRoleAksesSummary(SUPER_ADMIN);
    assert.deepEqual(
      summary.map((s) => s.role).sort(),
      ['Admin Cabang', 'Admin DP', 'Asisten Manager Kota', 'Manager Kota', 'SPV Drop Point'],
    );
    assert.equal(summary.find((s) => s.role === 'Admin Cabang')!.count, 1);
    assert.equal(summary.find((s) => s.role === 'Manager Kota')!.count, 1);
  });

  it('16. listRoleAksesSummary: Admin Cabang -> TETAP cuma 2 kartu (SPV Drop Point/Admin DP), TIDAK berubah', async () => {
    const summary = await roleAkses.listRoleAksesSummary(ADMIN_CABANG);
    assert.deepEqual(
      summary.map((s) => s.role).sort(),
      ['Admin DP', 'SPV Drop Point'],
    );
  });

  it('17. listAccountsByRole: Super Admin buka kartu "Manager Kota" -> konteks "Kota <nama>" dari tabel cabang, akun tanpa penugasan -> "(belum ditugaskan ke Kota)"', async () => {
    const managers = await roleAkses.listAccountsByRole(SUPER_ADMIN, 'Manager Kota');
    const manager = managers.find((m) => m.email === MANAGER_KOTA)!;
    assert.equal(manager.konteks, 'Kota Batang');

    const asistens = await roleAkses.listAccountsByRole(SUPER_ADMIN, 'Asisten Manager Kota');
    const asisten = asistens.find((a) => a.email === ASISTEN_MANAGER)!;
    assert.equal(asisten.konteks, '(belum ditugaskan ke Kota)');
  });

  it('18. listAccountsByRole: Super Admin buka kartu "Admin Cabang" -> konteks label statis "Akses penuh (Cabang)"', async () => {
    const accounts = await roleAkses.listAccountsByRole(SUPER_ADMIN, 'Admin Cabang');
    const admincabang = accounts.find((a) => a.email === ADMIN_CABANG)!;
    assert.equal(admincabang.konteks, 'Akses penuh (Cabang)');
  });

  it('19. Super Admin: getRoleDefaultPermissions/getAccountPermissions utk Manager Kota -> 15 baris (bukan 5 spt SPV Drop Point/Admin DP)', async () => {
    const rows = await roleAkses.getRoleDefaultPermissions(SUPER_ADMIN, 'Manager Kota');
    assert.equal(rows.length, 15);
    const detail = await roleAkses.getAccountPermissions(SUPER_ADMIN, MANAGER_ID);
    assert.equal(detail.permissions.length, 15);
    assert.equal(detail.konteks, 'Kota Batang');
  });

  it('20. Super Admin: setUserPermissionOverride override 1 menu utk 1 akun Manager Kota -> tersimpan, akun Manager Kota LAIN/role lain tak ikut berubah', async () => {
    const detail = await roleAkses.setUserPermissionOverride(SUPER_ADMIN, MANAGER_ID, 'user_management', false);
    const row = detail.permissions.find((p) => p.menuKey === 'user_management')!;
    assert.equal(row.enabled, false);
    assert.equal(row.isOverride, true);

    const asistenDetail = await roleAkses.getAccountPermissions(SUPER_ADMIN, ASISTEN_ID);
    assert.equal(asistenDetail.permissions.find((p) => p.menuKey === 'user_management')!.enabled, true, 'akun/role lain tak ikut berubah');
  });

  it('21. REGRESI KRITIS: Admin Cabang/Manager Kota/Asisten Manager Kota TETAP DITOLAK (VALIDATION_ERROR) mengatur kartu role mereka SENDIRI - privilese eksklusif Super Admin', async () => {
    await assert.rejects(
      () => roleAkses.listAccountsByRole(ADMIN_CABANG, 'Admin Cabang'),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
    await assert.rejects(
      () => roleAkses.listAccountsByRole(ADMIN_CABANG, 'Manager Kota'),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
    await assert.rejects(
      () => roleAkses.getAccountPermissions(ADMIN_CABANG, MANAGER_ID),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
      'Admin Cabang tak boleh lihat izin akun Manager Kota - itu privilese Super Admin',
    );
    await assert.rejects(
      () => roleAkses.setRoleDefaultPermission(ADMIN_CABANG, 'Asisten Manager Kota', 'dashboard', false),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('22. REGRESI: Admin Cabang tetap BISA atur SPV Drop Point/Admin DP spt sebelumnya (privilese sempit tidak ikut hilang)', async () => {
    const detail = await roleAkses.setUserPermissionOverride(ADMIN_CABANG, SPV_ID, 'dashboard', false);
    assert.equal(detail.permissions.find((p) => p.menuKey === 'dashboard')!.enabled, false);
  });

  it('23. Manager Kota/Asisten Manager Kota (dirinya sendiri, walau full access) TETAP DITOLAK memanggil Role & Akses sama sekali - GATED_ROLES SPV/Admin DP saja yg diblokir sebelumnya, tapi role INI HARUS lolos requireManagerActor (FULL_ACCESS_ROLES) lalu ditolak assertManageableRole saat coba atur role sendiri', async () => {
    // Manager Kota LOLOS requireManagerActor (dia FULL_ACCESS_ROLES), tapi
    // manageableRolesFor('Manager Kota') cuma GATED_ROLES -> coba atur SPV
    // Drop Point/Admin DP tetap BOLEH (setara Admin Cabang).
    const detail = await roleAkses.setUserPermissionOverride(MANAGER_KOTA, ADMINDP_ID, 'dashboard', false);
    assert.equal(detail.permissions.find((p) => p.menuKey === 'dashboard')!.enabled, false);
    // Tapi TIDAK BOLEH atur role Manager Kota/Asisten Manager Kota/Admin
    // Cabang (termasuk dirinya sendiri) - sama spt Admin Cabang di test 21.
    await assert.rejects(
      () => roleAkses.listAccountsByRole(MANAGER_KOTA, 'Manager Kota'),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 2: menu_key 'role_akses' ditegakkan di requireManagerActor()
  // (satu titik, menutup KETUJUH fungsi export). Lapis GRANULAR yang MENUMPUK
  // di ATAS requireRole(FULL_ACCESS_ROLES), BUKAN menggantikannya:
  // - Super Admin: bypass permanen, nilai role_akses apa pun diabaikan.
  // - Admin Cabang/Manager Kota/Asisten Manager Kota: satu-satunya kelompok
  //   yang benar-benar terpengaruh - Super Admin bisa mencabut kemampuan
  //   mengedit matrix TANPA menurunkan status full access mereka.
  // - SPV Drop Point/Admin DP: sudah diblokir requireRole sejak awal &
  //   TETAP diblokir walau baris role_akses mereka bernilai true (mereka
  //   memang tak punya barisnya - fallback fetchGatedPermissionMap `?? true`).
  // --------------------------------------------------------------------------

  /** KETUJUH fungsi export, dgn argumen yang di kondisi normal PASTI berhasil
   *  utk actor full access - dipakai membuktikan gate-nya menutup semuanya
   *  (requireManagerActor dipanggil paling awal di tiap fungsi, jadi FORBIDDEN
   *  mendahului VALIDATION_ERROR/NOT_FOUND). */
  function tujuhExport(email: string): [string, () => Promise<unknown>][] {
    return [
      ['listRoleAksesSummary', () => roleAkses.listRoleAksesSummary(email)],
      ['listAccountsByRole', () => roleAkses.listAccountsByRole(email, 'SPV Drop Point')],
      ['getRoleDefaultPermissions', () => roleAkses.getRoleDefaultPermissions(email, 'SPV Drop Point')],
      ['setRoleDefaultPermission', () => roleAkses.setRoleDefaultPermission(email, 'SPV Drop Point', 'dashboard', false)],
      ['getAccountPermissions', () => roleAkses.getAccountPermissions(email, SPV_ID)],
      ['setUserPermissionOverride', () => roleAkses.setUserPermissionOverride(email, SPV_ID, 'dashboard', false)],
      ['resetUserPermissionOverride', () => roleAkses.resetUserPermissionOverride(email, SPV_ID, 'dashboard')],
    ];
  }

  it("24. CHECKPOINT 2: 'role_akses' dimatikan (default role) utk Admin Cabang -> KETUJUH fungsi export FORBIDDEN", async () => {
    store.get('role_permissions')!.find((r) => r.role === 'Admin Cabang' && r.menu_key === 'role_akses')!.enabled = false;
    for (const [nama, call] of tujuhExport(ADMIN_CABANG)) {
      await assert.rejects(
        call,
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
        `${nama} harus FORBIDDEN setelah role_akses dimatikan`,
      );
    }
  });

  it("25. CHECKPOINT 2: 'role_akses' dimatikan lewat OVERRIDE AKUN (user_permissions) - cuma akun itu yang terkunci, akun full access lain (Manager Kota) tetap normal", async () => {
    store.get('user_permissions')!.push({ user_id: 'u-admincabang', menu_key: 'role_akses', enabled: false });
    for (const [nama, call] of tujuhExport(ADMIN_CABANG)) {
      await assert.rejects(
        call,
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
        `${nama} harus FORBIDDEN utk akun yang di-override`,
      );
    }
    const summary = await roleAkses.listRoleAksesSummary(MANAGER_KOTA);
    assert.equal(summary.length, 2, 'akun full access LAIN tak ikut terkunci - override berlaku per akun');
  });

  it("26. CHECKPOINT 2: role_akses dimatikan per ROLE utk Manager Kota/Asisten Manager Kota -> keduanya terkunci independen, Admin Cabang TIDAK ikut", async () => {
    for (const role of ['Manager Kota', 'Asisten Manager Kota']) {
      store.get('role_permissions')!.find((r) => r.role === role && r.menu_key === 'role_akses')!.enabled = false;
    }
    for (const email of [MANAGER_KOTA, ASISTEN_MANAGER]) {
      await assert.rejects(
        () => roleAkses.listRoleAksesSummary(email),
        (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
      );
    }
    const summary = await roleAkses.listRoleAksesSummary(ADMIN_CABANG);
    assert.equal(summary.length, 2, 'Admin Cabang tak ikut terpengaruh - matinya per role');
  });

  it('27. REGRESI NOL (seed produksi, semua role_akses=true): Admin Cabang/Manager Kota/Asisten Manager Kota TETAP bisa memanggil KETUJUH fungsi export persis spt sebelum checkpoint ini', async () => {
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      for (const [nama, call] of tujuhExport(email)) {
        const hasil = await call();
        assert.ok(hasil !== undefined && hasil !== null, `${email}: ${nama} harus tetap berhasil dgn seed default`);
      }
    }
  });

  it("28. REGRESI: baris role_akses HILANG sama sekali dari role_permissions (data tak lengkap) -> jaring pengaman `?? true` -> TETAP bisa akses, BUKAN terkunci massal", async () => {
    store.set(
      'role_permissions',
      store.get('role_permissions')!.filter((r) => r.menu_key !== 'role_akses'),
    );
    for (const email of [ADMIN_CABANG, MANAGER_KOTA, ASISTEN_MANAGER]) {
      const summary = await roleAkses.listRoleAksesSummary(email);
      assert.equal(summary.length, 2, `${email} tak boleh terkunci cuma krn barisnya hilang`);
    }
  });

  it('29. Super Admin: TIDAK terpengaruh sama sekali - tetap bisa KETUJUH fungsi walau SEMUA baris role_permissions dimatikan + ada baris role_akses=false atas namanya (mustahil di produksi, disimulasikan utk buktikan bypass permanen)', async () => {
    for (const r of store.get('role_permissions')!) r.enabled = false;
    store.get('role_permissions')!.push({ role: 'Super Admin', menu_key: 'role_akses', enabled: false });
    store.get('user_permissions')!.push({ user_id: 'u-superadmin', menu_key: 'role_akses', enabled: false });
    for (const [nama, call] of tujuhExport(SUPER_ADMIN)) {
      const hasil = await call();
      assert.ok(hasil !== undefined && hasil !== null, `Super Admin: ${nama} harus tetap berhasil`);
    }
  });

  it('30. LAPIS, BUKAN PENGGANTI: SPV Drop Point/Admin DP TETAP FORBIDDEN (requireRole FULL_ACCESS_ROLES) walau role_akses mereka bernilai true - baik lewat default role maupun override akun', async () => {
    store.get('role_permissions')!.push(
      { role: 'SPV Drop Point', menu_key: 'role_akses', enabled: true },
      { role: 'Admin DP', menu_key: 'role_akses', enabled: true },
    );
    store.get('user_permissions')!.push(
      { user_id: SPV_ID, menu_key: 'role_akses', enabled: true },
      { user_id: 'u-admindp2', menu_key: 'role_akses', enabled: true },
    );
    for (const email of [SPV, ADMIN_DP_LAIN]) {
      for (const [nama, call] of tujuhExport(email)) {
        await assert.rejects(
          call,
          (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
          `${email}: ${nama} harus tetap FORBIDDEN - lapis kasar requireRole tak boleh tergantikan lapis granular`,
        );
      }
    }
  });

  it('31. assertManageableRole TIDAK berubah: Admin Cabang dgn role_akses=true tetap DITOLAK (VALIDATION_ERROR, bukan FORBIDDEN) mengatur kartu role-nya sendiri - dua pembatasan terpisah, tak saling mengganggu', async () => {
    await assert.rejects(
      () => roleAkses.listAccountsByRole(ADMIN_CABANG, 'Admin Cabang'),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
    // ...dan Super Admin memang boleh mematikan role_akses milik Admin Cabang
    // (tak ada jalur self-lockout: Admin Cabang sendiri tak bisa menyentuh
    // kartu rolenya sendiri, lihat penolakan di atas).
    const detail = await roleAkses.setUserPermissionOverride(SUPER_ADMIN, 'u-admincabang', 'role_akses', false);
    assert.equal(detail.permissions.find((p) => p.menuKey === 'role_akses')!.enabled, false);
    await assert.rejects(
      () => roleAkses.listRoleAksesSummary(ADMIN_CABANG),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
      'setelah dicabut Super Admin, akun itu tak bisa lagi membuka Role & Akses',
    );
    // Dinyalakan lagi -> normal kembali (bukti reversibel).
    await roleAkses.resetUserPermissionOverride(SUPER_ADMIN, 'u-admincabang', 'role_akses');
    const summary = await roleAkses.listRoleAksesSummary(ADMIN_CABANG);
    assert.equal(summary.length, 2, 'kembali normal setelah di-reset ke default');
  });
});
