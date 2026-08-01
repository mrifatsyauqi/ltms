// Fix bug: item nav (mis. "Feedback Long Tail") tetap tampil di Sidebar
// walau menu_key-nya sudah dimatikan lewat Role & Akses - HARUS hilang
// total, bukan cuma isinya diblokir backend setelah diklik. Murni fungsi
// (tanpa DB), test langsung.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterNavByAccess, navForRole } from './nav.ts';

describe('nav.ts: filterNavByAccess() - sembunyikan item nav yang menu_key-nya dimatikan', () => {
  it('1. access null (full access) -> groups dikembalikan APA ADANYA, tak pernah difilter', () => {
    const groups = navForRole('Admin Cabang');
    assert.deepEqual(filterNavByAccess(groups, null), groups);
  });

  it('2. semua menu_key true -> SPV Drop Point/Admin DP tetap dapat semua item (regresi: tak boleh ada yg ikut hilang)', () => {
    const groups = navForRole('SPV Drop Point');
    const filtered = filterNavByAccess(groups, {
      dashboard: true,
      feedback_longtail_view: true,
      feedback_longtail_edit: true,
      riwayat_feedback: true,
    });
    assert.deepEqual(filtered, groups);
  });

  it('3. feedback_longtail_view=false -> item "Feedback Long Tail" HILANG TOTAL dari nav (bukan cuma disabled), item lain tetap ada', () => {
    const groups = navForRole('SPV Drop Point');
    const filtered = filterNavByAccess(groups, {
      dashboard: true,
      feedback_longtail_view: false,
      feedback_longtail_edit: true,
      riwayat_feedback: true,
    });
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(!labels.includes('Feedback Long Tail'), 'harus hilang total dari nav, bukan sekadar ditandai nonaktif');
    assert.ok(labels.includes('Dashboard'));
    assert.ok(labels.includes('Riwayat Feedback'));
  });

  it('4. Monitoring Delivery & Profil Saya SELALU tampil walau SEMUA menu_key false (tidak masuk matrix, tanpa menuKey)', () => {
    const groups = navForRole('Admin DP');
    const filtered = filterNavByAccess(groups, {
      dashboard: false,
      feedback_longtail_view: false,
      feedback_longtail_edit: false,
      riwayat_feedback: false,
    });
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.deepEqual(labels, ['Monitoring Delivery', 'Profil Saya']);
  });

  it('5. dashboard=false utk Admin DP -> item "Dashboard" hilang, sisanya tetap (verifikasi per-item, bukan cuma per-grup)', () => {
    const groups = navForRole('Admin DP');
    const filtered = filterNavByAccess(groups, {
      dashboard: false,
      feedback_longtail_view: true,
      feedback_longtail_edit: true,
      riwayat_feedback: true,
    });
    const labels = filtered.flatMap((g) => g.items.map((i) => i.label));
    assert.deepEqual(labels, ['Monitoring Delivery', 'Feedback Long Tail', 'Riwayat Feedback', 'Profil Saya']);
  });
});
