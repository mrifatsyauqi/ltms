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
 *  daftar lengkap di tiap test (cuma yang relevan yg perlu disebut eksplisit).
 *  CATATAN: sejak restrukturisasi Cabang/Drop Point, master_cabang=true di
 *  sini TIDAK merepresentasikan default produksi Admin Cabang/Manager Kota/
 *  Asisten Manager Kota (default asli mereka sekarang FALSE - lihat
 *  master_cabang_drop_point_default_false_migration.sql) - helper ini murni
 *  baseline generik "semua true" utk test yang TIDAK terkait Cabang/Drop
 *  Point, supaya struktur "Cabang + Drop Point nested" tetap konsisten
 *  dgn assertion lama yang tak berkaitan dgn perubahan ini. Test yang
 *  SPESIFIK menguji restrukturisasi Cabang/Drop Point ada di describe block
 *  terpisah di bawah, dgn override master_cabang eksplisit. */
function access(overrides: Partial<Record<MenuKey, boolean>> = {}): Record<MenuKey, boolean> {
  const base = Object.fromEntries(MENU_KEYS.map((k) => [k, true])) as Record<MenuKey, boolean>;
  return { ...base, ...overrides };
}

describe('nav.ts: filterNavByAccess() - sembunyikan item nav yang menu_key-nya dimatikan', () => {
  it('1. access null (Super Admin / role tak dikenal) -> groups dikembalikan APA ADANYA, tak difilter', () => {
    const groups = navForRole('Super Admin', null);
    assert.deepEqual(filterNavByAccess(groups, null), groups);
  });

  it('2. semua menu_key true -> SPV Drop Point/Admin DP tetap dapat semua item (regresi: tak boleh ada yg ikut hilang)', () => {
    const acc = access();
    const groups = navForRole('SPV Drop Point', acc);
    const filtered = filterNavByAccess(groups, acc);
    assert.deepEqual(filtered, groups);
  });

  it('3. feedback_longtail_view=false -> item "Feedback Long Tail" HILANG TOTAL dari nav (bukan cuma disabled), item lain tetap ada', () => {
    const acc = access({ feedback_longtail_view: false });
    const groups = navForRole('SPV Drop Point', acc);
    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Feedback Long Tail'), 'harus hilang total dari nav, bukan sekadar ditandai nonaktif');
    assert.ok(labels.includes('Dashboard'));
    assert.ok(labels.includes('Riwayat Feedback'));
    assert.ok(labels.includes('Monitoring Delivery'), 'menu_key beda (monitoring_delivery_dp) tak ikut terpengaruh');
  });

  it('4. Profil Saya SELALU tampil walau SEMUA menu_key false (tidak masuk matrix, tanpa menuKey) - Monitoring Delivery ikut hilang krn SEKARANG digating (monitoring_delivery_dp)', () => {
    const acc = Object.fromEntries(MENU_KEYS.map((k) => [k, false])) as Record<MenuKey, boolean>;
    const groups = navForRole('Admin DP', acc);
    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.deepEqual(labels, ['Profil Saya']);
  });

  it('5. dashboard=false utk Admin DP -> item "Dashboard" hilang, sisanya tetap (verifikasi per-item, bukan cuma per-grup)', () => {
    const acc = access({ dashboard: false });
    const groups = navForRole('Admin DP', acc);
    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.deepEqual(labels, ['Monitoring Delivery', 'Monitoring INC', 'Feedback Long Tail', 'Riwayat Feedback', 'Profil Saya']);
  });

  // --------------------------------------------------------------------------
  // Monitoring INC: Full Access dan DP roles memiliki menu_key "monitoring_inc"
  // --------------------------------------------------------------------------

  it('5b. Monitoring INC utk Full Access & DP roles punya menu_key "monitoring_inc" - mati kalau monitoring_inc=false', () => {
    for (const role of ['Admin Cabang', 'SPV Drop Point', 'Admin DP']) {
      const acc = access({ monitoring_inc: false });
      const groups = navForRole(role, acc);
      const filtered = filterNavByAccess(groups, acc);
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes('Monitoring INC'), `${role}: harus hilang krn monitoring_inc=false`);

      const accOn = access({ monitoring_inc: true });
      const filteredOn = filterNavByAccess(navForRole(role, accOn), accOn);
      const labelsOn = filteredOn.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(labelsOn.includes('Monitoring INC'), `${role}: harus muncul saat monitoring_inc=true`);
    }
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
      const acc = access({ monitoring_delivery_dp: false, monitoring_delivery_cabang: true });
      const groups = navForRole(role, acc);
      const filtered = filterNavByAccess(groups, acc);
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes('Monitoring Delivery'), `${role}: harus hilang krn monitoring_delivery_dp=false`);
    }
  });

  it('7. Monitoring Delivery utk full access (Admin Cabang) pakai menu_key "monitoring_delivery_cabang" - punya menuKey (bukan lagi selalu-tampil tanpa menuKey)', () => {
    const groups = navForRole('Admin Cabang', access());
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
    const acc = access({ monitoring_delivery_cabang: false });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Monitoring Delivery'), 'harus hilang - backend-nya sudah FORBIDDEN utk role ini');
    assert.ok(labels.includes('Dashboard'));
    assert.ok(labels.includes('Feedback Long Tail'));
    assert.ok(labels.includes('Data Long Tail'));
    assert.ok(labels.includes('Cabang'), 'master_cabang=true di baseline access() -> struktur Cabang (bukan Drop Point berdiri sendiri)');
    assert.ok(labels.includes('Riwayat Feedback'));
    assert.ok(labels.includes('Profile'));
  });

  it('9. REGRESI: full access dgn SEMUA menu_key true -> nav SAMA PERSIS spt tak difilter (nol perubahan perilaku)', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const acc = access();
      const groups = navForRole(role, acc);
      assert.deepEqual(filterNavByAccess(groups, acc), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  it('10. Dashboard/Feedback Long Tail/Riwayat Feedback di menu full access punya menuKey (penegakan backend-nya SUDAH ada) - dimatikan -> hilang', () => {
    const acc = access({ dashboard: false, feedback_longtail_view: false, riwayat_feedback: false });
    const groups = navForRole('Admin Cabang', acc);
    const byLabel = new Map(groups.flatMap((g) => g.items).map((i) => [i.label, i]));
    assert.equal(byLabel.get('Dashboard')?.menuKey, 'dashboard');
    assert.equal(byLabel.get('Feedback Long Tail')?.menuKey, 'feedback_longtail_view');
    assert.equal(byLabel.get('Riwayat Feedback')?.menuKey, 'riwayat_feedback');

    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Dashboard'));
    assert.ok(!labels.includes('Feedback Long Tail'));
    assert.ok(!labels.includes('Riwayat Feedback'));
    assert.ok(labels.includes('Data Long Tail'), 'menu_key lain (tak disentuh test ini) tak ikut hilang');
  });

  it('11. GUARD: SEMUA item nav full access punya menuKey, KECUALI Profile (sengaja tak pernah masuk matrix, lihat MENU_KEYS)', () => {
    const groups = navForRole('Admin Cabang', access());
    const all = groups.flatMap((g) => [...g.items, ...(g.items.flatMap((i) => i.children ?? []))]);
    for (const item of all) {
      if (
        item.label === 'Profile' ||
        item.label === 'Message Templates' ||
        item.label === 'Card Templates' ||
        item.label === 'Groups'
      ) {
        assert.equal(item.menuKey, undefined, 'Communication Center & Profile sengaja SELALU tampil, tak pernah masuk matrix');
        continue;
      }
      assert.ok(item.menuKey, `"${item.label}" harus punya menuKey - tak ada item full access yg "sengaja belum digating"`);
    }
  });

  it("11b. item \"Role & Akses\" (grup Master Data) punya menuKey 'role_akses'", () => {
    const groups = navForRole('Admin Cabang', access());
    const item = groups.flatMap((g) => g.items).find((i) => i.label === 'Role & Akses');
    assert.equal(item?.menuKey, 'role_akses');
  });

  it('11c. role_akses=false utk Admin Cabang -> item "Role & Akses" HILANG dari sidebar, item lain grup Master Data TETAP UTUH', () => {
    const acc = access({ role_akses: false });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Role & Akses'), 'harus hilang - backend-nya sudah FORBIDDEN utk akun ini');
    assert.ok(labels.includes('Cabang'));
    assert.ok(labels.includes('Master Feedback'));
    assert.ok(labels.includes('User Management'));
    assert.ok(labels.includes('Dashboard'), 'menu di grup lain tak ikut terpengaruh');
  });

  it('11d. REGRESI: SPV Drop Point/Admin DP tak pernah punya item "Role & Akses" di nav-nya - nilai role_akses apa pun tak berpengaruh ke mereka', () => {
    for (const role of ['SPV Drop Point', 'Admin DP']) {
      const acc1 = access();
      const before = filterNavByAccess(navForRole(role, acc1), acc1);
      const acc2 = access({ role_akses: false });
      const afterOff = filterNavByAccess(navForRole(role, acc2), acc2);
      assert.deepEqual(afterOff, before, `${role}: mematikan role_akses tak boleh mengubah apa pun`);
      assert.ok(!before.flatMap((g) => g.items.map((i) => i.label)).includes('Role & Akses'));
    }
  });

  // --------------------------------------------------------------------------
  // 3 menu_key: 'data_longtail' (page-level saja, cabang view=data di
  // /feedback), 'import_longtail' (page-level + requirePermission() di
  // importLongTail()), 'riwayat_import' (page-level SAJA - listImportBatches()
  // SENGAJA tak digating krn dipakai bersama oleh panel riwayat di /import).
  // --------------------------------------------------------------------------

  it('11e. "Data Long Tail"/"Import Long Tail"/"Riwayat Import" punya menuKey masing2', () => {
    const groups = navForRole('Admin Cabang', access());
    const byLabel = new Map(groups.flatMap((g) => g.items).map((i) => [i.label, i]));
    assert.equal(byLabel.get('Data Long Tail')?.menuKey, 'data_longtail');
    assert.equal(byLabel.get('Import Long Tail')?.menuKey, 'import_longtail');
    assert.equal(byLabel.get('Riwayat Import')?.menuKey, 'riwayat_import');
  });

  it('11f. matikan data_longtail/import_longtail/riwayat_import SATU-SATU utk Admin Cabang -> item terkait hilang, sisanya utuh', () => {
    for (const [key, label] of [
      ['data_longtail', 'Data Long Tail'],
      ['import_longtail', 'Import Long Tail'],
      ['riwayat_import', 'Riwayat Import'],
    ] as const) {
      const acc = access({ [key]: false });
      const groups = navForRole('Admin Cabang', acc);
      const filtered = filterNavByAccess(groups, acc);
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes(label), `${label} harus hilang krn ${key}=false`);
      assert.ok(labels.includes('Feedback Long Tail'), `${key}=false tak boleh ikut menghilangkan item lain`);
      assert.ok(labels.includes('Cabang'), `${key}=false tak boleh menyentuh menu_key lain`);
    }
  });

  it('11g. REGRESI: full access dgn SEMUA menu_key true -> Data Long Tail/Import Long Tail/Riwayat Import tetap tampil, nol perubahan', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const acc = access();
      const groups = navForRole(role, acc);
      assert.deepEqual(filterNavByAccess(groups, acc), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  // --------------------------------------------------------------------------
  // 4 menu_key Master Data (write functions SAJA - listCabang/listDropPoints/
  // listMasterFeedback/listUsers SENGAJA tak digating, dipakai bersama
  // dropdown di halaman lain). Test di bawah ini pakai baseline access()
  // (master_cabang=true) supaya item "Cabang" tetap dipakai (fokus test ini
  // bukan restrukturisasi Cabang/Drop Point - itu di describe terpisah di
  // bawah, ini fokus ke filterNavByAccess() mekanismenya). "Cabang" SEKARANG
  // item FLAT tanpa children (Drop Point dikelola via tab di halaman
  // /master/cabang, BUKAN nested nav item - lihat CabangDropPointTabs).
  // --------------------------------------------------------------------------

  it('11h. "Cabang"/"Master Feedback"/"User Management" punya menuKey masing2, "Cabang" TANPA children (Drop Point dikelola via tab, bukan nested nav)', () => {
    const groups = navForRole('Admin Cabang', access());
    const cabang = groups.flatMap((g) => g.items).find((i) => i.label === 'Cabang');
    assert.equal(cabang?.menuKey, 'master_cabang');
    assert.equal('children' in cabang!, false, '"Cabang" harus flat - TIDAK ADA "Drop Point" nested/terpisah di sidebar utk actor yg punya akses master_cabang');
    const byLabel = new Map(groups.flatMap((g) => g.items).map((i) => [i.label, i]));
    assert.equal(byLabel.get('Master Feedback')?.menuKey, 'master_feedback');
    assert.equal(byLabel.get('User Management')?.menuKey, 'user_management');
  });

  it('11j. master_drop_point=false SAJA (master_cabang=true) -> TIDAK MEMPENGARUHI "Cabang" sama sekali (Cabang tak lagi punya children yg bisa disentuh oleh key ini)', () => {
    const acc = access({ master_drop_point: false });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const masterData = filtered.find((g) => g.label === 'Master Data');
    const cabang = masterData?.items.find((i) => i.label === 'Cabang');
    assert.ok(cabang, '"Cabang" tetap tampil - menuKey-nya sendiri (master_cabang) masih true');
    assert.equal('children' in cabang!, false, '"Cabang" tetap flat, tak ada children yg bisa dipengaruhi master_drop_point');
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Drop Point'), 'Drop Point tak pernah jadi nav item terpisah saat master_cabang=true - dikelola via tab di /master/cabang');
    assert.ok(labels.includes('Master Feedback'));
    assert.ok(labels.includes('User Management'));
  });

  it('11k. matikan master_feedback/user_management SATU-SATU utk Admin Cabang -> item terkait hilang, sisanya (termasuk Cabang) utuh', () => {
    for (const [key, label] of [
      ['master_feedback', 'Master Feedback'],
      ['user_management', 'User Management'],
    ] as const) {
      const acc = access({ [key]: false });
      const groups = navForRole('Admin Cabang', acc);
      const filtered = filterNavByAccess(groups, acc);
      const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes(label), `${label} harus hilang krn ${key}=false`);
      assert.ok(labels.includes('Cabang'), `${key}=false tak boleh menyentuh Cabang`);
    }
  });

  it('11l. REGRESI: full access dgn SEMUA menu_key true -> Cabang/Master Feedback/User Management tetap tampil, nol perubahan', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const acc = access();
      const groups = navForRole(role, acc);
      assert.deepEqual(filterNavByAccess(groups, acc), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  // --------------------------------------------------------------------------
  // 'pengaturan' - SATU gerbang utk KEDUA sub-fitur di halaman /pengaturan
  // (Link Berbagi Laporan di public-share.ts, Reset Data Long Tail di
  // longtail.ts) - SENGAJA tak dipecah lebih granular per sub-fitur.
  // --------------------------------------------------------------------------

  it('11m. item "Pengaturan" (grup Pengaturan) punya menuKey \'pengaturan\'', () => {
    const groups = navForRole('Admin Cabang', access());
    const item = groups.flatMap((g) => g.items).find((i) => i.label === 'Pengaturan');
    assert.equal(item?.menuKey, 'pengaturan');
  });

  it('11n. pengaturan=false utk Admin Cabang -> item "Pengaturan" HILANG dari sidebar, "Profile" (grup sama, tak pernah masuk matrix) TETAP tampil, item grup lain tak ikut terpengaruh', () => {
    const acc = access({ pengaturan: false });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Pengaturan'), 'harus hilang - backend-nya sudah FORBIDDEN utk akun ini');
    assert.ok(labels.includes('Profile'), 'Profile tak pernah masuk matrix, selalu tampil');
    assert.ok(labels.includes('Dashboard'));
    assert.ok(labels.includes('Cabang'));
  });

  it('11o. REGRESI: full access dgn SEMUA menu_key true -> Pengaturan tetap tampil, nol perubahan - SEMUA 15 menu_key punya menuKey', () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota', 'Super Admin']) {
      const acc = access();
      const groups = navForRole(role, acc);
      assert.deepEqual(filterNavByAccess(groups, acc), groups, `${role}: seed all-true tak boleh menghilangkan apa pun`);
    }
  });

  // --------------------------------------------------------------------------
  // filterNavByAccess() dulu cuma memfilter group.items, TIDAK pernah masuk ke
  // item.children (submenu "Drop Point" di bawah "Cabang"). TERBUKTI berefek
  // nyata di data nav ASLI (lihat test 11j) - blok di bawah ini tetap
  // dipertahankan sbg cakupan tambahan pakai struktur tiruan (kasus
  // grandchild/multi-level yang belum ada di data nav sungguhan).
  // --------------------------------------------------------------------------

  const icon = navForRole('Admin Cabang', access())[0].items[0].icon;
  /** Tiruan struktur "Cabang > Drop Point" dgn menuKey terpasang. */
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
// RESTRUKTURISASI: "Cabang" vs "Drop Point" (Super Admin vs Admin Cabang dkk).
// Sejak kebijakan default master_cabang=false utk Admin Cabang/Manager Kota/
// Asisten Manager Kota (master_cabang_drop_point_default_false_migration.sql),
// struktur nav BUKAN lagi statis per-role - navForRole(role, access) ikut
// akses NYATA ke 'master_cabang': punya akses -> HANYA 1 item "Cabang", FLAT
// (TIDAK ADA "Drop Point" nested/terpisah - Drop Point dikelola lewat TAB di
// dalam halaman /master/cabang, lihat CabangDropPointTabs) (Super Admin,
// praktiknya); tidak punya akses -> TIDAK ADA "Cabang" sama sekali, "Drop
// Point" jadi item LEVEL ATAS sendiri (Admin Cabang/Manager Kota/Asisten
// Manager Kota, praktiknya) - tapi logicnya murni ikut access.master_cabang,
// BUKAN hardcode nama role, supaya override "Per Akun" (Super Admin
// menyalakan master_cabang utk 1 akun tertentu) otomatis dapat struktur yang
// sama tanpa perlu ubah kode.
//
// CATATAN REGRESI: percobaan implementasi PERTAMA sempat SALAH memasang
// "Drop Point" sbg nested child di bawah "Cabang" saat canCabang=true -
// ketahuan dari laporan produksi (screenshot: Super Admin masih melihat item
// "Drop Point" di sidebar-nya). Test 18 & 20 di bawah SENGAJA menegaskan
// TIDAK ADA `children` sama sekali pada "Cabang" utk mengunci regresi ini.
// ----------------------------------------------------------------------------
describe('nav.ts: navForRole() - restrukturisasi Cabang (Super Admin) vs Drop Point (Admin Cabang dkk)', () => {
  const MASTER_DP_HREF = '/master/drop-point';

  it('18. access null (Super Admin, bypass permanen) -> HANYA "Cabang" di grup Master Data, FLAT (TIDAK ADA "Drop Point" nested ATAU level atas)', () => {
    const groups = navForRole('Super Admin', null);
    const masterData = groups.find((g) => g.label === 'Master Data');
    const topLevelLabels = masterData!.items.map((i) => i.label);
    assert.deepEqual(topLevelLabels, ['Cabang', 'Master Feedback', 'User Management', 'Role & Akses']);
    assert.ok(!topLevelLabels.includes('Drop Point'), 'Drop Point TIDAK BOLEH jadi item terpisah - dikelola via tab di /master/cabang');
    const cabang = masterData!.items.find((i) => i.label === 'Cabang')!;
    assert.equal(cabang.menuKey, 'master_cabang');
    assert.equal(cabang.href, '/master/cabang');
    assert.equal('children' in cabang, false, 'REGRESI GUARD: "Cabang" tak boleh punya children sama sekali - Drop Point BUKAN nested nav item');
  });

  it("19. DEFAULT PRODUKSI Admin Cabang/Manager Kota/Asisten Manager Kota (master_cabang=false, master_drop_point=true) -> TIDAK ADA \"Cabang\" sama sekali, \"Drop Point\" jadi item LEVEL ATAS tersendiri (bukan nested)", () => {
    for (const role of ['Admin Cabang', 'Manager Kota', 'Asisten Manager Kota']) {
      const acc = access({ master_cabang: false, master_drop_point: true });
      const groups = navForRole(role, acc);
      const filtered = filterNavByAccess(groups, acc);
      const masterData = filtered.find((g) => g.label === 'Master Data');
      const topLevelLabels = masterData!.items.map((i) => i.label);
      assert.ok(!topLevelLabels.includes('Cabang'), `${role}: "Cabang" tak boleh muncul sama sekali - role ini tak punya menu itu`);
      assert.ok(topLevelLabels.includes('Drop Point'), `${role}: "Drop Point" harus jadi item level atas`);
      const dropPoint = masterData!.items.find((i) => i.label === 'Drop Point')!;
      assert.equal(dropPoint.href, MASTER_DP_HREF, 'href SAMA PERSIS dgn punya Super Admin - satu sumber data, tak ada duplikasi');
      assert.equal(dropPoint.menuKey, 'master_drop_point');
      assert.equal('children' in dropPoint, false, '"Drop Point" level atas tak punya children (bukan turunan siapa pun)');
    }
  });

  it('20. Admin Cabang DIBERI akses master_cabang=true lewat override "Per Akun" -> struktur BERUBAH OTOMATIS jadi SAMA PERSIS dgn Super Admin ("Cabang" flat, TANPA Drop Point terpisah), TANPA ubah kode', () => {
    const acc = access({ master_cabang: true, master_drop_point: true });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const masterData = filtered.find((g) => g.label === 'Master Data');
    const topLevelLabels = masterData!.items.map((i) => i.label);
    assert.ok(topLevelLabels.includes('Cabang'), 'override master_cabang=true -> "Cabang" muncul');
    assert.ok(!topLevelLabels.includes('Drop Point'), '"Drop Point" tak boleh jadi item terpisah apa pun - dikelola via tab di dalam Cabang');
    const cabang = masterData!.items.find((i) => i.label === 'Cabang')!;
    assert.equal('children' in cabang, false, 'REGRESI GUARD: sama seperti Super Admin - "Cabang" flat, tak ada children');
  });

  it('21. Admin Cabang TANPA akses master_cabang MAUPUN master_drop_point -> grup Master Data kehilangan KEDUANYA, item lain (Master Feedback/User Management/Role & Akses) TETAP UTUH', () => {
    const acc = access({ master_cabang: false, master_drop_point: false });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const masterData = filtered.find((g) => g.label === 'Master Data');
    const topLevelLabels = masterData!.items.map((i) => i.label);
    assert.ok(!topLevelLabels.includes('Cabang'));
    assert.ok(!topLevelLabels.includes('Drop Point'));
    assert.ok(topLevelLabels.includes('Master Feedback'));
    assert.ok(topLevelLabels.includes('User Management'));
    assert.ok(topLevelLabels.includes('Role & Akses'));
  });

  it('22. Admin Cabang PUNYA master_cabang=false TAPI master_drop_point JUGA false (Super Admin cabut akses DP-nya) -> "Drop Point" ikut hilang (tak "diselamatkan" krn levelnya berubah jadi top-level)', () => {
    const acc = access({ master_cabang: false, master_drop_point: false });
    const groups = navForRole('Admin Cabang', acc);
    const filtered = filterNavByAccess(groups, acc);
    const masterData = filtered.find((g) => g.label === 'Master Data');
    assert.ok(!masterData!.items.some((i) => i.label === 'Drop Point'));
  });

  it('23. REGRESI: SPV Drop Point/Admin DP TIDAK TERPENGARUH sama sekali oleh restrukturisasi ini (branch mereka tak pernah punya item Cabang/Drop Point Master Data) - nav identik apa pun nilai master_cabang', () => {
    for (const role of ['SPV Drop Point', 'Admin DP']) {
      const accTrue = access({ master_cabang: true });
      const groupsTrue = filterNavByAccess(navForRole(role, accTrue), accTrue);
      const accFalse = access({ master_cabang: false });
      const groupsFalse = filterNavByAccess(navForRole(role, accFalse), accFalse);
      assert.deepEqual(groupsTrue, groupsFalse, `${role}: master_cabang tak relevan sama sekali utk role ini`);
      const labels = groupsTrue.flatMap((g) => g.items.map((i) => i.label));
      assert.ok(!labels.includes('Cabang'));
      assert.ok(!labels.includes('Drop Point'), 'SPV Drop Point/Admin DP tak punya menu Master Data sama sekali (Monitoring Delivery beda menu_key)');
    }
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
