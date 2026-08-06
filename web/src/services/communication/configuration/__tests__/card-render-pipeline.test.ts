// Verifikasi PERSISTEN: pemetaan Kecamatan -> Kode DP (drop_point_kecamatan)
// dipakai render pipeline Monitoring INC utk resolusi mention. Fungsi
// produksi ASLI dijalankan via mock.module pada boundary db() - pola sama
// dgn test lain di sesi ini (lihat fake-db.test-support.ts).
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from '../../../../lib/data/supabase/fake-db.test-support.ts';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('drop_point_kecamatan', [
    { id: 'dpk1', kode_dp: 'BGG06', kecamatan: 'WARUNGASEM' },
    { id: 'dpk2', kode_dp: 'BGG06', kecamatan: 'WONOTUNGGAL' },
  ]);
  store.set('master_drop_point', [
    { kode_dp: 'BGG06', nama_dp: 'WARUNGASEM' },
  ]);
  store.set('communication_mention_mappings', [
    {
      id: 'dp1',
      scope_type: 'drop_point',
      scope_key: 'BGG06',
      pic_name: 'Budi Santoso',
      role: 'SPV Drop Point Warungasem',
      feishu_open_id: 'ou_budi_bgg06',
      feishu_user_id: null,
      phone: null,
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'kec1',
      scope_type: 'kecamatan',
      scope_key: 'LIMPUNG',
      pic_name: 'Rian Hidayat',
      role: 'Admin DP Limpung',
      feishu_open_id: 'ou_rian_limpung',
      feishu_user_id: null,
      phone: null,
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ]);
  return store;
}

describe('CardRenderPipeline.resolveMentionMap (monitoring_inc): pemetaan Kecamatan -> Kode DP', () => {
  let pipeline: typeof import('../card-render-pipeline.service.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('@/lib/data/supabase/client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    pipeline = await import('../card-render-pipeline.service.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('Kecamatan "Wonotunggal" & "Warungasem" (satu DP BGG06) -> mention SAMA persis, bukan dianggap tujuan terpisah', async () => {
    const { CardRenderPipeline } = pipeline;
    const mentionMap = await CardRenderPipeline.resolveMentionMap('monitoring_inc', {
      subdistricts: [
        { name: 'Wonotunggal', count: '5 AWB' },
        { name: 'Warungasem', count: '8 AWB' },
      ],
    });

    const wonotunggal = mentionMap.get('WONOTUNGGAL');
    const warungasem = mentionMap.get('WARUNGASEM');
    assert.ok(wonotunggal && wonotunggal.length > 0, 'Wonotunggal harus dapat mention (via DP BGG06)');
    assert.ok(warungasem && warungasem.length > 0, 'Warungasem harus dapat mention (via DP BGG06)');
    assert.equal(wonotunggal![0].feishu_open_id, 'ou_budi_bgg06');
    assert.equal(warungasem![0].feishu_open_id, 'ou_budi_bgg06');
    assert.deepEqual(wonotunggal, warungasem, 'PIC utk Wonotunggal harus identik dgn Warungasem, bukan tujuan terpisah');
  });

  it('Kecamatan yang belum ada di drop_point_kecamatan -> fallback ke mention per-Kecamatan lama (tidak hilang)', async () => {
    const { CardRenderPipeline } = pipeline;
    const mentionMap = await CardRenderPipeline.resolveMentionMap('monitoring_inc', {
      subdistricts: [{ name: 'Limpung', count: '3 AWB' }],
    });

    const limpung = mentionMap.get('LIMPUNG');
    assert.ok(limpung && limpung.length > 0);
    assert.equal(limpung![0].feishu_open_id, 'ou_rian_limpung');
  });

  it('Kecamatan yang resolve ke DP tapi DP-nya belum punya PIC drop_point-scope -> tidak crash, cuma tanpa mention', async () => {
    store.set('communication_mention_mappings', []); // tidak ada PIC sama sekali
    const { CardRenderPipeline } = pipeline;
    const mentionMap = await CardRenderPipeline.resolveMentionMap('monitoring_inc', {
      subdistricts: [{ name: 'Wonotunggal', count: '5 AWB' }],
    });
    assert.equal(mentionMap.get('WONOTUNGGAL'), undefined);
  });
});
