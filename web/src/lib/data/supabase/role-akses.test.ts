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

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { id: 'u-admincabang', email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', nik: '1000000001', status_aktif: true },
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
  store.set('role_permissions', [
    { role: 'SPV Drop Point', menu_key: 'dashboard', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'feedback_longtail_view', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'feedback_longtail_edit', enabled: true },
    { role: 'SPV Drop Point', menu_key: 'riwayat_feedback', enabled: true },
    { role: 'Admin DP', menu_key: 'dashboard', enabled: true },
    { role: 'Admin DP', menu_key: 'feedback_longtail_view', enabled: true },
    { role: 'Admin DP', menu_key: 'feedback_longtail_edit', enabled: true },
    { role: 'Admin DP', menu_key: 'riwayat_feedback', enabled: true },
  ]);
  store.set('user_permissions', []);
  return store;
}

const ADMIN_CABANG = 'admincabang@ltms.test';
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

  it('6. getRoleDefaultPermissions: 4 baris lengkap sesuai seed (semua true)', async () => {
    const rows = await roleAkses.getRoleDefaultPermissions(ADMIN_CABANG, 'SPV Drop Point');
    assert.equal(rows.length, 4);
    assert.ok(rows.every((r) => r.enabled === true));
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

  it('8. setRoleDefaultPermission dipanggil DUA KALI (ubah lagi) -> tetap 4 baris (upsert, bukan duplikat) - regresi utk perbaikan FakeQuery composite onConflict', async () => {
    await roleAkses.setRoleDefaultPermission(ADMIN_CABANG, 'SPV Drop Point', 'dashboard', false);
    await roleAkses.setRoleDefaultPermission(ADMIN_CABANG, 'SPV Drop Point', 'dashboard', true);
    const rows = await roleAkses.getRoleDefaultPermissions(ADMIN_CABANG, 'SPV Drop Point');
    assert.equal(rows.length, 4, 'harus tetap 4 baris, bukan bertambah jadi duplikat');
    assert.equal(rows.find((r) => r.menuKey === 'dashboard')!.enabled, true);
  });

  it('9. getAccountPermissions: akun tanpa override -> semua isOverride=false, ikut default role', async () => {
    const detail = await roleAkses.getAccountPermissions(ADMIN_CABANG, SPV_ID);
    assert.equal(detail.nama, 'Ahmad Fauzi');
    assert.equal(detail.customCount, 0);
    assert.ok(detail.permissions.every((p) => p.isOverride === false && p.enabled === true));
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
});
