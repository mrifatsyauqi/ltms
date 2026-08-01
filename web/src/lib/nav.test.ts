// Fix bug: item nav (mis. "Feedback Long Tail") tetap tampil di Sidebar
// walau menu_key-nya sudah dimatikan lewat Role & Akses - HARUS hilang
// total, bukan cuma isinya diblokir backend setelah diklik. Murni fungsi
// (tanpa DB), test langsung.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterNavByAccess, navForRole, type NavGroup } from './nav.ts';
import { MENU_KEYS, type MenuKey } from './data/supabase/permissions.ts';
import { GATED_ROLES, isGatedRole } from './data/permissions.ts';

/** Semua 15 menu_key = true, dgn override opsional - hindari mengulang
 *  daftar lengkap di tiap test (cuma yang relevan yg perlu disebut eksplisit). */
function access(overrides: Partial<Record<MenuKey, boolean>> = {}): Record<MenuKey, boolean> {
  const base = Object.fromEntries(MENU_KEYS.map((k) => [k, true])) as Record<MenuKey, boolean>;
  return { ...base, ...overrides };
}

describe('nav.ts: filterNavByAccess() - sembunyikan item nav yang menu_key-nya dimatikan', () => {
  it('1. access null (Super Admin / role tak dikenal) -> groups dikembalikan APA ADANYA, tak difilter', () => {
    const groups = navForRole('Super Admin');
    assert.deepEqual(filterNavByAccess(groups, null), groups);
  });

  it('2. semua menu_key true -> SPV Drop Point/Admin DP tetap dapat semua item (regresi: tak boleh ada yg ikut hilang)', () => {
    const groups = navForRole('SPV Drop Point');
    const filtered = filterNavByAccess(groups, access());
    assert.deepEqual(filtered, groups);
  });

  it('3. feedback_longtail_view=false -> item "Feedback Long Tail" HILANG TOTAL dari nav (bukan cuma disabled), item lain tetap ada', () => {
    const groups = navForRole('SPV Drop Point');
    const filtered = filterNavByAccess(groups, access({ feedback_longtail_view: false }));
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Feedback Long Tail'), 'harus hilang total dari nav, bukan sekadar ditandai nonaktif');
    assert.ok(labels.includes('Dashboard'));
    assert.ok(labels.includes('Riwayat Feedback'));
    assert.ok(labels.includes('Monitoring Delivery'), 'menu_key beda (monitoring_delivery_dp) tak ikut terpengaruh');
  });

  it('4. Profil Saya SELALU tampil walau SEMUA menu_key false (tidak masuk matrix, tanpa menuKey) - Monitoring Delivery ikut hilang krn SEKARANG digating (monitoring_delivery_dp)', () => {
    const groups = navForRole('Admin DP');
    const filtered = filterNavByAccess(
      groups,
      Object.fromEntries(MENU_KEYS.map((k) => [k, false])) as Record<MenuKey, boolean>,
    );
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.deepEqual(labels, ['Profil Saya']);
  });

  it('5. dashboard=false utk Admin DP -> item "Dashboard" hilang, sisanya tetap (verifikasi per-item, bukan cuma per-grup)', () => {
    const groups = navForRole('Admin DP');
    const filtered = filterNavByAccess(groups, access({ dashboard: false }));
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.deepEqual(labels, ['Monitoring Delivery', 'Feedback Long Tail', 'Riwayat Feedback', 'Profil Saya']);
  });

  // --------------------------------------------------------------------------
  // Reassignment mode Monitoring Delivery: SPV Drop Point PINDAH ke mode
  // per-Sprinter (monitoring_delivery_dp, gabung Admin DP) - BUKAN LAGI mode
  // Refine Total cabang (monitoring_delivery_cabang, milik Admin Cabang/
  // Manager Kota/Asisten Manager Kota). Sebelumnya SPV Drop Point salah
  // ditempatkan di mode cabang & gagal fetch /api/drop-points (FORBIDDEN).
  // --------------------------------------------------------------------------

  it('6. Monitoring Delivery utk SPV Drop Point/Admin DP pakai menu_key "monitoring_delivery_dp" (BUKAN "monitoring_delivery_cabang") - mati kalau monitoring_delivery_dp=false walau monitoring_delivery_cabang=true', () => {
    for (const role of ['SPV Drop Point', 'Admin DP']) {
      const groups = navForRole(role);
      const filtered = filterNavByAccess(groups, access({ monitoring_delivery_dp: false, monitoring_delivery_cabang: true }));
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes('Monitoring Delivery'), `${role}: harus hilang krn monitoring_delivery_dp=false`);
    }
  });

  it('7. Monitoring Delivery utk full access (Admin Cabang) pakai menu_key "monitoring_delivery_cabang" - punya menuKey (bukan lagi selalu-tampil tanpa menuKey)', () => {
    const groups = navForRole('Admin Cabang');
    const item = groups.flatMap((g) => g.items).find((i) => i.label === 'Monitoring Delivery');
    assert.equal(item?.menuKey, 'monitoring_delivery_cabang');
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 1: sidebar role full access (SELAIN Super Admin) SEKARANG ikut
  // difilter. Sebelumnya layout.tsx cuma menghitung menuAccess utk 2 role DP
  // -> access selalu null utk Admin Cabang dkk -> TIDAK ADA item yang pernah
  // hilang, padahal backend-nya sudah FORBIDDEN (mis.
  // monitoring_delivery_cabang). Super Admin TETAP null (bypass permanen).
  // --------------------------------------------------------------------------

  it('8. Admin Cabang (full access, non Super Admin) dgn monitoring_delivery_cabang=false -> item Monitoring Delivery HILANG, item lain utuh', () => {
    const groups = navForRole('Admin Cabang');
    const filtered = filterNavByAccess(groups, access({ monitoring_delivery_cabang: false }));
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Monitoring Delivery'), 'harus hilang - backend-nya sudah FORBIDDEN utk role ini');
    assert.ok(labels.includes('Dashboard'));
    assert.ok(labels.includes('Feedback Long Tail'));
    assert.ok(labels.includes('Data Long Tail'));
    assert.ok(labels.includes('Cabang'));
    assert.ok(labels.includes('Riwayat Feedback'));
    assert.ok(labels.includes('Profile'));
  });

  it('9. REGRESI: full access dgn SEMUA menu_key true (kondisi seed produksi) -> nav SAMA PERSIS spt tak difilter (nol perubahan perilaku hari ini)', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const groups = navForRole(role);
      assert.deepEqual(filterNavByAccess(groups, access()), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  it('10. Dashboard/Feedback Long Tail/Riwayat Feedback di menu full access punya menuKey (penegakan backend-nya SUDAH ada) - dimatikan -> hilang', () => {
    const groups = navForRole('Admin Cabang');
    const byLabel = new Map(groups.flatMap((g) => g.items).map((i) => [i.label, i]));
    assert.equal(byLabel.get('Dashboard')?.menuKey, 'dashboard');
    assert.equal(byLabel.get('Feedback Long Tail')?.menuKey, 'feedback_longtail_view');
    assert.equal(byLabel.get('Riwayat Feedback')?.menuKey, 'riwayat_feedback');

    const filtered = filterNavByAccess(groups, access({ dashboard: false, feedback_longtail_view: false, riwayat_feedback: false }));
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Dashboard'));
    assert.ok(!labels.includes('Feedback Long Tail'));
    assert.ok(!labels.includes('Riwayat Feedback'));
    assert.ok(labels.includes('Data Long Tail'), 'menu_key lain (belum digating backend) tak ikut hilang');
  });

  it('11. GUARD: item full access yang backend-nya BELUM digating SENGAJA masih tanpa menuKey (dipasang nanti barengan gate page + endpoint-nya)', () => {
    const groups = navForRole('Admin Cabang');
    const all = groups.flatMap((g) => [...g.items, ...(g.items.flatMap((i) => i.children ?? []))]);
    // "Role & Akses" TIDAK LAGI di daftar ini sejak CHECKPOINT 2, "Data Long
    // Tail"/"Import Long Tail"/"Riwayat Import" TIDAK LAGI sejak CHECKPOINT 3,
    // "Cabang"/"Drop Point"/"Master Feedback"/"User Management" TIDAK LAGI
    // sejak CHECKPOINT 4 - backend-nya masing2 sudah menegakkan menu_key-nya.
    const belumDigating = ['Pengaturan'];
    for (const label of belumDigating) {
      const item = all.find((i) => i.label === label);
      assert.ok(item, `item "${label}" harus ada di nav full access`);
      assert.equal(item!.menuKey, undefined, `"${label}" belum punya penegakan backend - JANGAN pasang menuKey duluan`);
    }
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 2: 'role_akses' - menu_key ke-4 (setelah dashboard,
  // feedback_longtail_view, riwayat_feedback + monitoring_delivery_cabang)
  // yang penegakan backend-nya sudah ada, jadi menuKey-nya BOLEH dipasang.
  // --------------------------------------------------------------------------

  it("11b. CHECKPOINT 2: item \"Role & Akses\" (grup Master Data) SEKARANG punya menuKey 'role_akses' - dipasang BARENGAN requirePermission() di requireManagerActor + gate page", () => {
    const groups = navForRole('Admin Cabang');
    const item = groups.flatMap((g) => g.items).find((i) => i.label === 'Role & Akses');
    assert.equal(item?.menuKey, 'role_akses');
  });

  it('11c. role_akses=false utk Admin Cabang -> item "Role & Akses" HILANG dari sidebar, item lain grup Master Data (belum digating) TETAP UTUH', () => {
    const groups = navForRole('Admin Cabang');
    const filtered = filterNavByAccess(groups, access({ role_akses: false }));
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Role & Akses'), 'harus hilang - backend-nya sudah FORBIDDEN utk akun ini');
    assert.ok(labels.includes('Cabang'));
    assert.ok(labels.includes('Master Feedback'));
    assert.ok(labels.includes('User Management'));
    assert.ok(labels.includes('Dashboard'), 'menu di grup lain tak ikut terpengaruh');
  });

  it('11d. REGRESI: SPV Drop Point/Admin DP tak pernah punya item "Role & Akses" di nav-nya - nilai role_akses apa pun tak berpengaruh ke mereka', () => {
    for (const role of ['SPV Drop Point', 'Admin DP']) {
      const groups = navForRole(role);
      const before = filterNavByAccess(groups, access());
      const afterOff = filterNavByAccess(groups, access({ role_akses: false }));
      assert.deepEqual(afterOff, before, `${role}: mematikan role_akses tak boleh mengubah apa pun`);
      assert.ok(!before.flatMap((g) => g.items.map((i) => i.label)).includes('Role & Akses'));
    }
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 3: 3 menu_key baru yang penegakan backend-nya sudah ada -
  // 'data_longtail' (page-level saja, cabang view=data di /feedback),
  // 'import_longtail' (page-level + requirePermission() di importLongTail()),
  // 'riwayat_import' (page-level SAJA - listImportBatches() SENGAJA tak
  // digating krn dipakai bersama oleh panel riwayat di dalam /import).
  // --------------------------------------------------------------------------

  it("11e. CHECKPOINT 3: \"Data Long Tail\"/\"Import Long Tail\"/\"Riwayat Import\" SEKARANG punya menuKey masing2", () => {
    const groups = navForRole('Admin Cabang');
    const byLabel = new Map(groups.flatMap((g) => g.items).map((i) => [i.label, i]));
    assert.equal(byLabel.get('Data Long Tail')?.menuKey, 'data_longtail');
    assert.equal(byLabel.get('Import Long Tail')?.menuKey, 'import_longtail');
    assert.equal(byLabel.get('Riwayat Import')?.menuKey, 'riwayat_import');
  });

  it('11f. matikan data_longtail/import_longtail/riwayat_import SATU-SATU utk Admin Cabang -> item terkait hilang, sisanya (termasuk yang belum digating) utuh', () => {
    const groups = navForRole('Admin Cabang');
    for (const [key, label] of [
      ['data_longtail', 'Data Long Tail'],
      ['import_longtail', 'Import Long Tail'],
      ['riwayat_import', 'Riwayat Import'],
    ] as const) {
      const filtered = filterNavByAccess(groups, access({ [key]: false }));
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes(label), `${label} harus hilang krn ${key}=false`);
      assert.ok(labels.includes('Feedback Long Tail'), `${key}=false tak boleh ikut menghilangkan item lain`);
      assert.ok(labels.includes('Cabang'), `${key}=false tak boleh menyentuh item yg belum digating`);
    }
  });

  it('11g. REGRESI: full access dgn SEMUA menu_key true (kondisi seed produksi) -> Data Long Tail/Import Long Tail/Riwayat Import tetap tampil, nol perubahan', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const groups = navForRole(role);
      assert.deepEqual(filterNavByAccess(groups, access()), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  // --------------------------------------------------------------------------
  // CHECKPOINT 4: 4 menu_key Master Data yang penegakan backend-nya sudah ada
  // (write functions SAJA - listCabang/listDropPoints/listMasterFeedback/
  // listUsers SENGAJA tak digating, dipakai bersama dropdown di halaman lain).
  // "Drop Point" nested di bawah "Cabang" - ini kali PERTAMA menuKey nested
  // dipasang di data nav ASLI (bukan cuma struktur tiruan test 12-15), jadi
  // ini juga bukti nyata fix rekursi filterItems() (CHECKPOINT 1) BENAR
  // dipakai, bukan cuma teruji di struktur tiruan.
  // --------------------------------------------------------------------------

  it("11h. CHECKPOINT 4: \"Cabang\"/\"Drop Point\"/\"Master Feedback\"/\"User Management\" SEKARANG punya menuKey masing2", () => {
    const groups = navForRole('Admin Cabang');
    const cabang = groups.flatMap((g) => g.items).find((i) => i.label === 'Cabang');
    assert.equal(cabang?.menuKey, 'master_cabang');
    assert.equal(cabang?.children?.find((c) => c.label === 'Drop Point')?.menuKey, 'master_drop_point');
    const byLabel = new Map(groups.flatMap((g) => g.items).map((i) => [i.label, i]));
    assert.equal(byLabel.get('Master Feedback')?.menuKey, 'master_feedback');
    assert.equal(byLabel.get('User Management')?.menuKey, 'user_management');
  });

  it('11i. master_cabang=false utk Admin Cabang -> "Cabang" DAN "Drop Point" (anaknya) hilang SEKALIGUS (parent mati -> subtree hilang), item lain grup Master Data (Master Feedback/User Management/Role & Akses) TETAP UTUH', () => {
    const groups = navForRole('Admin Cabang');
    const filtered = filterNavByAccess(groups, access({ master_cabang: false }));
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Cabang'), 'harus hilang - backend-nya sudah FORBIDDEN');
    const masterData = filtered.find((g) => g.label === 'Master Data');
    assert.ok(!masterData?.items.some((i) => i.children?.some((c) => c.label === 'Drop Point')), 'Drop Point ikut hilang krn parent-nya mati');
    assert.ok(labels.includes('Master Feedback'));
    assert.ok(labels.includes('User Management'));
    assert.ok(labels.includes('Role & Akses'));
  });

  it('11j. BUKTI FIX REKURSI CHILDREN (data nav ASLI, bukan struktur tiruan): master_drop_point=false SAJA (master_cabang=true) -> "Cabang" TETAP tampil TANPA anak "Drop Point", item lain utuh', () => {
    const groups = navForRole('Admin Cabang');
    const filtered = filterNavByAccess(groups, access({ master_drop_point: false }));
    const masterData = filtered.find((g) => g.label === 'Master Data');
    const cabang = masterData?.items.find((i) => i.label === 'Cabang');
    assert.ok(cabang, '"Cabang" tetap tampil - menuKey-nya sendiri (master_cabang) masih true');
    assert.equal('children' in cabang!, false, 'properti children harus dibuang total, bukan array kosong (lihat komentar filterItems)');
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(labels.includes('Master Feedback'));
    assert.ok(labels.includes('User Management'));
  });

  it('11k. matikan master_feedback/user_management SATU-SATU utk Admin Cabang -> item terkait hilang, sisanya (termasuk Cabang/Drop Point) utuh', () => {
    const groups = navForRole('Admin Cabang');
    for (const [key, label] of [
      ['master_feedback', 'Master Feedback'],
      ['user_management', 'User Management'],
    ] as const) {
      const filtered = filterNavByAccess(groups, access({ [key]: false }));
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes(label), `${label} harus hilang krn ${key}=false`);
      assert.ok(labels.includes('Cabang'), `${key}=false tak boleh menyentuh Cabang`);
      const masterData = filtered.find((g) => g.label === 'Master Data');
      assert.ok(masterData?.items.some((i) => i.children?.some((c) => c.label === 'Drop Point')), `${key}=false tak boleh menyentuh Drop Point`);
    }
  });

  it('11l. REGRESI: full access dgn SEMUA menu_key true (kondisi seed produksi) -> Cabang/Drop Point/Master Feedback/User Management tetap tampil, nol perubahan', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const groups = navForRole(role);
      assert.deepEqual(filterNavByAccess(groups, access()), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  // --------------------------------------------------------------------------
  // filterNavByAccess() dulu cuma memfilter group.items, TIDAK pernah masuk ke
  // item.children (submenu "Drop Point" di bawah "Cabang"). Belum berefek hari
  // ini (children-nya belum ada yang bermenuKey), diperbaiki DULUAN sbg fix
  // struktural supaya begitu menuKey-nya dipasang nanti, filternya sudah benar.
  // --------------------------------------------------------------------------

  const icon = navForRole('Admin Cabang')[0].items[0].icon;
  /** Tiruan struktur "Cabang > Drop Point" dgn menuKey terpasang (nav asli
   *  belum punya - lihat test 11). */
  function nested(): NavGroup[] {
    return [
      {
        label: 'Master Data',
        items: [
          {
            label: 'Cabang',
            href: '/master/cabang',
            icon,
            menuKey: 'master_cabang',
            children: [
              { label: 'Drop Point', href: '/master/drop-point', icon, menuKey: 'master_drop_point' },
              { label: 'Anak Tanpa Gating', href: '/master/lain', icon },
            ],
          },
        ],
      },
    ];
  }

  it('12. children ikut difilter per menu_key-nya sendiri: master_drop_point=false -> submenu "Drop Point" hilang, parent "Cabang" TETAP tampil', () => {
    const filtered = filterNavByAccess(nested(), access({ master_drop_point: false }));
    const parent = filtered[0].items[0];
    assert.equal(parent.label, 'Cabang', 'parent tetap tampil krn menuKey-nya sendiri masih true');
    assert.deepEqual(parent.children?.map((c) => c.label), ['Anak Tanpa Gating']);
  });

  it('13. parent mati -> SELURUH subtree hilang (children tak boleh "menyelamatkan" parent yang menuKey-nya false)', () => {
    const filtered = filterNavByAccess(nested(), access({ master_cabang: false }));
    assert.deepEqual(filtered, [], 'grup jadi kosong -> ikut dibuang');
  });

  it('14. semua children mati tapi parent hidup -> parent tetap tampil TANPA properti children (bukan array kosong - Sidebar merender chevron submenu berdasar item.children truthy)', () => {
    const filtered = filterNavByAccess(nested(), access({ master_drop_point: false }));
    const parent = filtered[0].items[0];
    assert.ok(parent.children, 'masih ada 1 anak yang lolos');

    const semuaAnakMati = nested();
    semuaAnakMati[0].items[0].children![1].menuKey = 'master_feedback';
    const hasil = filterNavByAccess(semuaAnakMati, access({ master_drop_point: false, master_feedback: false }));
    const parent2 = hasil[0].items[0];
    assert.equal(parent2.label, 'Cabang');
    assert.equal('children' in parent2, false, 'properti children HARUS dibuang, bukan disisakan []');
  });

  it('15. children semua lolos -> hasil identik dgn input (regresi: filter tak boleh mengubah bentuk saat tak ada yang dimatikan)', () => {
    const groups = nested();
    assert.deepEqual(filterNavByAccess(groups, access()), groups);
  });
});

// ----------------------------------------------------------------------------
// Keputusan "siapa dapat menuAccess terhitung vs null" di app/(app)/layout.tsx.
// Server Component tak bisa di-unit-test langsung di setup ini, tapi
// predikatnya (isGatedRole) diekstrak & dipakai apa adanya di sana -> logic
// pemilihan role-nya tetap teruji, dan TIDAK BISA drift dari otorisasi runtime
// (hasPermission/getEffectiveMenuAccess memakai predikat yang sama persis).
// ----------------------------------------------------------------------------
describe('layout.tsx: role mana yang menuAccess-nya dihitung (isGatedRole)', () => {
  it('16. 5 role gated (termasuk Admin Cabang/Manager Kota/Asisten Manager Kota) -> menuAccess DIHITUNG, bukan null lagi spt sebelumnya (dulu cuma 2 role DP)', () => {
    assert.deepEqual([...GATED_ROLES].sort(), ['Admin Cabang', 'Admin DP', 'Asisten Manager Kota', 'Manager Kota', 'SPV Drop Point']);
    for (const role of GATED_ROLES) assert.equal(isGatedRole(role), true, `${role} harus dihitung akses menunya`);
  });

  it('17. Super Admin & role tak dikenal (legacy "Admin Pusat") -> BUKAN gated -> menuAccess null -> sidebar tak difilter sama sekali', () => {
    assert.equal(isGatedRole('Super Admin'), false, 'bypass permanen - query DB sengaja dilewati, akses efektifnya toh all-true');
    assert.equal(isGatedRole('Admin Pusat'), false);
    assert.equal(isGatedRole(''), false);
  });
});
