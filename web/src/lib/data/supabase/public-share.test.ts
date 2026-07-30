// Verifikasi PERSISTEN validasi token Link Berbagi Laporan (Checkpoint 2-3) -
// fungsi produksi asli (findActiveShareLink, getDashboardPublic,
// listLongTailPublic, endpoint GET /api/public/[token]/{dashboard,longtail})
// dieksekusi lewat mock.module() pada boundary db() saja - pola sama dgn
// access-control.test.ts/import.test.ts.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('public_share_links', [
    { token: 'a'.repeat(32), dibuat_oleh: 'admincabang@ltms.test', revoked: false, created_at: '2026-07-30T00:00:00+07:00' },
    { token: 'b'.repeat(32), dibuat_oleh: 'admincabang@ltms.test', revoked: true, created_at: '2026-07-29T00:00:00+07:00' },
  ]);
  store.set('public_share_access_log', []);
  store.set('longtail', [
    { no_waybill: 'WB-A', status_terakhir: 'ON DELIVERY', alasan_bermasalah: '', dp_sampai: 'BATANG01', waktu_sampai: '2026-07-28 10:00:00', umur_frozen: null, sprinter_delivery: 'Budi Santoso', cod: 'NONCOD', delivery_attempt: 1, feedback: '', log_feedback: '', perlu_review: false, version: 1 },
    { no_waybill: 'WB-B', status_terakhir: 'ON DELIVERY', alasan_bermasalah: '', dp_sampai: 'BANDAR01', waktu_sampai: '2026-07-27 09:00:00', umur_frozen: 5, sprinter_delivery: 'Citra Dewi', cod: 'NONCOD', delivery_attempt: 1, feedback: 'Sudah TTD diterima penerima', log_feedback: '', perlu_review: false, version: 1 },
  ]);
  store.set('activity_log', []);
  return store;
}

const ACTIVE_TOKEN = 'a'.repeat(32);
const REVOKED_TOKEN = 'b'.repeat(32);
const UNKNOWN_TOKEN = 'f'.repeat(32);

describe('Link Berbagi Laporan: validasi token & endpoint publik Dashboard (eksekusi nyata, fungsi produksi asli)', () => {
  let publicShare: typeof import('./public-share.ts');
  let dashboardLib: typeof import('./dashboard.ts');
  let longtailLib: typeof import('./longtail.ts');
  let dashboardRoute: typeof import('@/app/api/public/[token]/dashboard/route.ts');
  let longtailRoute: typeof import('@/app/api/public/[token]/longtail/route.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    publicShare = await import('./public-share.ts');
    dashboardLib = await import('./dashboard.ts');
    longtailLib = await import('./longtail.ts');
    dashboardRoute = await import('@/app/api/public/[token]/dashboard/route.ts');
    longtailRoute = await import('@/app/api/public/[token]/longtail/route.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('findActiveShareLink: token aktif -> ditemukan', async () => {
    const link = await publicShare.findActiveShareLink(ACTIVE_TOKEN);
    assert.deepEqual(link, { token: ACTIVE_TOKEN });
  });

  it('findActiveShareLink: token sudah di-revoke -> null (SAMA seperti tidak ada, pesan generik)', async () => {
    const link = await publicShare.findActiveShareLink(REVOKED_TOKEN);
    assert.equal(link, null);
  });

  it('findActiveShareLink: token tidak ada di DB sama sekali -> null', async () => {
    const link = await publicShare.findActiveShareLink(UNKNOWN_TOKEN);
    assert.equal(link, null);
  });

  it('getDashboardPublic: selalu agregat Semua DP (2 baris, 2 DP) - fungsi produksi asli, bukan replika', async () => {
    const data = await dashboardLib.getDashboardPublic();
    assert.equal(data.summary.total, 2, 'harus mencakup semua DP, tak ada filter');
    assert.equal(data.monitoringDp.length, 2);
  });

  it('GET /api/public/[token]/dashboard: token aktif -> 200 + data, tercatat ke access log', async () => {
    const req = new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/dashboard`, {
      headers: { 'x-forwarded-for': '203.0.113.5', 'user-agent': 'test-agent' },
    });
    const res = await dashboardRoute.GET(req, { params: Promise.resolve({ token: ACTIVE_TOKEN }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.data.summary.total, 2);

    const logs = store.get('public_share_access_log')!;
    assert.equal(logs.length, 1);
    assert.equal(logs[0].token, ACTIVE_TOKEN);
    assert.equal(logs[0].halaman, 'dashboard');
    assert.equal(logs[0].ip_address, '203.0.113.5');
  });

  it('GET /api/public/[token]/dashboard: token di-revoke -> DITOLAK, pesan generik, TIDAK tercatat ke access log', async () => {
    const req = new Request(`http://localhost/api/public/${REVOKED_TOKEN}/dashboard`);
    const res = await dashboardRoute.GET(req, { params: Promise.resolve({ token: REVOKED_TOKEN }) });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(store.get('public_share_access_log')!.length, 0, 'akses gagal tak boleh tercatat sbg akses berhasil');
  });

  it('GET /api/public/[token]/dashboard: token tidak dikenal -> DITOLAK sama persis (pesan generik, tak bisa dibedakan dari revoked)', async () => {
    const req = new Request(`http://localhost/api/public/${UNKNOWN_TOKEN}/dashboard`);
    const res = await dashboardRoute.GET(req, { params: Promise.resolve({ token: UNKNOWN_TOKEN }) });
    const bodyRevoked = await (
      await dashboardRoute.GET(new Request(`http://localhost/api/public/${REVOKED_TOKEN}/dashboard`), {
        params: Promise.resolve({ token: REVOKED_TOKEN }),
      })
    ).json();
    const bodyUnknown = await res.json();
    assert.equal(res.status, 404);
    assert.equal(bodyUnknown.message, bodyRevoked.message, 'pesan HARUS identik - tak boleh bocorkan alasan spesifik');
  });

  it('listLongTailPublic: selalu Semua DP (2 baris, lintas DP), data APA ADANYA tanpa masking (nama sprinter dst)', async () => {
    const rows = await longtailLib.listLongTailPublic();
    assert.equal(rows.length, 2, 'harus mencakup semua DP, tak ada filter');
    const wbA = rows.find((r) => r['No. Waybill'] === 'WB-A')!;
    const wbB = rows.find((r) => r['No. Waybill'] === 'WB-B')!;
    assert.equal(wbA['Sprinter Delivery'], 'Budi Santoso', 'nama sprinter apa adanya, tanpa masking/anonimisasi');
    assert.equal(wbB['Sprinter Delivery'], 'Citra Dewi');
    assert.equal(wbB.__isClearTTD, true);
  });

  it('GET /api/public/[token]/longtail: token aktif -> 200 + data, tercatat ke access log dgn halaman "data-longtail"', async () => {
    const req = new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/longtail`, {
      headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'test-agent-2' },
    });
    const res = await longtailRoute.GET(req, { params: Promise.resolve({ token: ACTIVE_TOKEN }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.data.length, 2);

    const logs = store.get('public_share_access_log')!;
    assert.equal(logs.length, 1);
    assert.equal(logs[0].halaman, 'data-longtail', 'HARUS beda dgn halaman dashboard - dasar breakdown per halaman di UI Kelola Link');
  });

  it('GET /api/public/[token]/longtail: token di-revoke -> DITOLAK, pesan generik, TIDAK tercatat ke access log', async () => {
    const req = new Request(`http://localhost/api/public/${REVOKED_TOKEN}/longtail`);
    const res = await longtailRoute.GET(req, { params: Promise.resolve({ token: REVOKED_TOKEN }) });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(store.get('public_share_access_log')!.length, 0);
  });

  it('akses dashboard & data-longtail tercatat TERPISAH (breakdown per halaman) utk token yg sama', async () => {
    await dashboardRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/dashboard`), {
      params: Promise.resolve({ token: ACTIVE_TOKEN }),
    });
    await longtailRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/longtail`), {
      params: Promise.resolve({ token: ACTIVE_TOKEN }),
    });
    await longtailRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/longtail`), {
      params: Promise.resolve({ token: ACTIVE_TOKEN }),
    });
    const logs = store.get('public_share_access_log')!;
    assert.equal(logs.filter((l) => l.halaman === 'dashboard').length, 1);
    assert.equal(logs.filter((l) => l.halaman === 'data-longtail').length, 2);
  });
});
