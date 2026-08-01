// Fix bug: item nav (mis. "Feedback Long Tail") tetap tampil di Sidebar
// walau menu_key-nya sudah dimatikan lewat Role & Akses - HARUS hilang
// total, bukan cuma isinya diblokir backend setelah diklik. Murni fungsi
// (tanpa DB), test langsung.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterNavByAccess, navForRole } from './nav.ts';
import { MENU_KEYS, type MenuKey } from './data/supabase/permissions.ts';

/** Semua 15 menu_key = true, dgn override opsional - hindari mengulang
 *  daftar lengkap di tiap test (cuma yang relevan yg perlu disebut eksplisit). */
function access(overrides: Partial<Record<MenuKey, boolean>> = {}): Record<MenuKey, boolean> {
  const base = Object.fromEntries(MENU_KEYS.map((k) => [k, true])) as Record<MenuKey, boolean>;
  return { ...base, ...overrides };
}

describe('nav.ts: filterNavByAccess() - sembunyikan item nav yang menu_key-nya dimatikan', () => {
  it('1. access null (full access) -> groups dikembalikan APA ADANYA, tak pernah difilter', () => {
    const groups = navForRole('Admin Cabang');
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

  it('7. Monitoring Delivery utk full access (Admin Cabang) pakai menu_key "monitoring_delivery_cabang" - punya menuKey (bukan lagi selalu-tampil tanpa menuKey), walau saat ini belum benar2 difilter krn access selalu null utk role ini (lihat layout.tsx)', () => {
    const groups = navForRole('Admin Cabang');
    const item = groups.flatMap((g) => g.items).find((i) => i.label === 'Monitoring Delivery');
    assert.equal(item?.menuKey, 'monitoring_delivery_cabang');
  });
});
