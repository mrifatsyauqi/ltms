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
  store.set('users', [
    { email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
    { email: 'admindp@ltms.test', nama: 'Admin DP', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
  ]);
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

  it('rate limit: request ke-16 (melebihi RATE_LIMIT_LONGTAIL_MAX=15) dalam 1 menit -> 429, tak tercatat ke access log', async () => {
    const now = new Date().toISOString();
    // 14 akses "berhasil" sebelumnya (dlm jendela 1 menit) - request BERIKUT
    // ini (ke-15) masih harus lolos (14 < 15), baru request SETELAHNYA ditolak.
    store.set(
      'public_share_access_log',
      Array.from({ length: 14 }, () => ({ token: ACTIVE_TOKEN, halaman: 'data-longtail', accessed_at: now, ip_address: null, user_agent: null })),
    );

    const req = () => longtailRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/longtail`), { params: Promise.resolve({ token: ACTIVE_TOKEN }) });

    const res15 = await req(); // akses ke-15 total - masih di bawah limit (15), harus lolos
    assert.equal(res15.status, 200, 'akses ke-15 (persis di batas) masih harus berhasil');
    assert.equal(store.get('public_share_access_log')!.length, 15);

    const res16 = await req(); // akses ke-16 - melebihi limit
    assert.equal(res16.status, 429);
    const body16 = await res16.json();
    assert.equal(body16.ok, false);
    assert.equal(body16.message, 'Terlalu banyak permintaan, coba lagi nanti.');
    assert.equal(store.get('public_share_access_log')!.length, 15, 'request yg ditolak rate limit TIDAK ikut tercatat sbg akses berhasil');
  });

  it('rate limit: akses lama (di luar jendela 1 menit) TIDAK ikut dihitung', async () => {
    const oldTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 menit lalu
    store.set(
      'public_share_access_log',
      Array.from({ length: 50 }, () => ({ token: ACTIVE_TOKEN, halaman: 'data-longtail', accessed_at: oldTimestamp, ip_address: null, user_agent: null })),
    );
    const res = await longtailRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/longtail`), {
      params: Promise.resolve({ token: ACTIVE_TOKEN }),
    });
    assert.equal(res.status, 200, '50 akses LAMA di luar jendela tak boleh memblokir akses baru');
  });

  it('rate limit: dashboard & data-longtail punya budget TERPISAH (bukan gabungan) - limit longtail penuh tak memblokir dashboard', async () => {
    const now = new Date().toISOString();
    store.set(
      'public_share_access_log',
      Array.from({ length: 15 }, () => ({ token: ACTIVE_TOKEN, halaman: 'data-longtail', accessed_at: now, ip_address: null, user_agent: null })),
    );
    const resLongtail = await longtailRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/longtail`), {
      params: Promise.resolve({ token: ACTIVE_TOKEN }),
    });
    assert.equal(resLongtail.status, 429, 'longtail sudah penuh (15/15)');

    const resDashboard = await dashboardRoute.GET(new Request(`http://localhost/api/public/${ACTIVE_TOKEN}/dashboard`), {
      params: Promise.resolve({ token: ACTIVE_TOKEN }),
    });
    assert.equal(resDashboard.status, 200, 'dashboard punya budget terpisah (0/30), tak boleh ikut terblokir');
  });

  it('createShareLink: Admin DP -> FORBIDDEN (hanya Admin Cabang, PRD Bagian 5)', async () => {
    store.set('public_share_links', []); // tak ada link aktif - tetap harus ditolak krn role, bukan krn conflict
    await assert.rejects(
      () => publicShare.createShareLink('admindp@ltms.test'),
      (err: unknown) => (err as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('createShareLink: Admin Cabang, BELUM ada link aktif -> berhasil, token baru revoked=false', async () => {
    store.set('public_share_links', []);
    const { token } = await publicShare.createShareLink('admincabang@ltms.test');
    assert.match(token, /^[0-9a-f]{32}$/);
    const link = await publicShare.getActiveShareLink();
    assert.equal(link?.token, token);
  });

  it('createShareLink: Admin Cabang, SUDAH ada link aktif -> CONFLICT (harus pakai Regenerate/Cabut dulu)', async () => {
    await assert.rejects(
      () => publicShare.createShareLink('admincabang@ltms.test'),
      (err: unknown) => (err as { code?: string }).code === 'CONFLICT',
    );
  });

  it('regenerateShareLink: link lama LANGSUNG revoked, token baru aktif menggantikan - link lama gagal diakses setelahnya', async () => {
    const oldToken = ACTIVE_TOKEN;
    const { token: newToken } = await publicShare.regenerateShareLink('admincabang@ltms.test');
    assert.notEqual(newToken, oldToken);

    const oldStillValid = await publicShare.findActiveShareLink(oldToken);
    assert.equal(oldStillValid, null, 'token lama HARUS langsung gagal diakses setelah regenerate');

    const newValid = await publicShare.findActiveShareLink(newToken);
    assert.deepEqual(newValid, { token: newToken });

    const active = await publicShare.getActiveShareLink();
    assert.equal(active?.token, newToken, 'hanya SATU link aktif setelah regenerate, yaitu yg baru');
  });

  it('regenerateShareLink: TANPA link aktif sebelumnya -> tetap berhasil membuat token baru (setara create)', async () => {
    store.set('public_share_links', []);
    const { token } = await publicShare.regenerateShareLink('admincabang@ltms.test');
    assert.match(token, /^[0-9a-f]{32}$/);
    assert.equal((await publicShare.getActiveShareLink())?.token, token);
  });

  it('revokeShareLink ("Cabut Total"): link aktif jadi tak bisa diakses, TIDAK ada token baru', async () => {
    await publicShare.revokeShareLink('admincabang@ltms.test');
    assert.equal(await publicShare.findActiveShareLink(ACTIVE_TOKEN), null);
    assert.equal(await publicShare.getActiveShareLink(), null, 'tak ada link baru dibuat - beda dari regenerate');
  });

  it('revokeShareLink: TANPA link aktif -> idempotent, tidak error', async () => {
    store.set('public_share_links', []);
    await publicShare.revokeShareLink('admincabang@ltms.test'); // tak boleh throw
    assert.equal(await publicShare.getActiveShareLink(), null);
  });

  it('getShareLinkStats: belum ada link aktif -> null', async () => {
    store.set('public_share_links', []);
    const stats = await publicShare.getShareLinkStats('admincabang@ltms.test');
    assert.equal(stats, null);
  });

  it('getShareLinkStats: total per halaman & akses 7 hari terakhir dihitung benar dari access log', async () => {
    const now = new Date().toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    store.set('public_share_access_log', [
      { token: ACTIVE_TOKEN, halaman: 'dashboard', accessed_at: now, ip_address: null, user_agent: null },
      { token: ACTIVE_TOKEN, halaman: 'dashboard', accessed_at: now, ip_address: null, user_agent: null },
      { token: ACTIVE_TOKEN, halaman: 'data-longtail', accessed_at: now, ip_address: null, user_agent: null },
      { token: ACTIVE_TOKEN, halaman: 'dashboard', accessed_at: eightDaysAgo, ip_address: null, user_agent: null }, // di luar 7 hari
    ]);
    const stats = await publicShare.getShareLinkStats('admincabang@ltms.test');
    assert.equal(stats?.totalDashboard, 3, 'total per halaman TIDAK dibatasi jendela waktu - semua histori token ini');
    assert.equal(stats?.totalDataLongtail, 1);
    assert.equal(stats?.akses7HariTerakhir, 3, 'akses 8 hari lalu HARUS dikecualikan dari "7 hari terakhir"');
  });
});
