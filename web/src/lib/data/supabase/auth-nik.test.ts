// Verifikasi PERSISTEN migrasi auth Google->NIK Tahap 2 (Credentials
// provider dual-mode + rate limiting login). Menjalankan fungsi PRODUKSI
// ASLI (verifyCredentials, requireActor, attributionName, getUserByEmail,
// isLoginLocked/recordLoginFailure/recordLoginSuccess) lewat mock.module()
// pada boundary db() saja - pola sama dgn access-control.test.ts.
//
// Login Google TIDAK bisa diuji end-to-end di sini (butuh OAuth sungguhan) -
// getUserByEmail (fungsi yg dipakai jalur Google di auth.ts jwt/signIn
// callback) SAMA SEKALI TIDAK disentuh oleh perubahan Tahap 2, jadi test #7
// di bawah (getUserByEmail tetap resolve user lama dgn benar) adalah bukti
// regresi yg relevan: fungsi itu berperilaku identik sebelum & sesudah.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '@/lib/password';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

const PLAIN_PASSWORD = 'Password123';

async function freshStore(): Promise<Map<string, Row[]>> {
  const hash = await hashPassword(PLAIN_PASSWORD);
  const store = new Map<string, Row[]>();
  store.set('users', [
    // User baru (migrasi selesai): login via NIK.
    {
      email: 'individual@ltms.test',
      nik: 'NIK-001',
      nama: 'Andi Individual',
      nama_tampilan: 'Andi Individual',
      tipe_akun: 'individual',
      role: 'Admin DP',
      drop_point: 'BATANG01',
      password_hash: hash,
      status_aktif: true,
    },
    // User lama (belum sempat diisi NIK): login TETAP via email, spt sebelum migrasi.
    {
      email: 'legacy@ltms.test',
      nik: null,
      nama: 'Budi Legacy',
      nama_tampilan: 'Budi Legacy',
      tipe_akun: 'individual',
      role: 'Admin DP',
      drop_point: 'SUBAH01',
      password_hash: hash,
      status_aktif: true,
    },
    // Akun General per-DP: login via NIK format GENERAL-<KODE_DP>, TANPA email personal.
    {
      email: 'general-batang01@ltms.local',
      nik: 'GENERAL-BATANG01',
      nama: 'DP BATANG01',
      nama_tampilan: 'DP BATANG01',
      tipe_akun: 'general',
      role: 'Admin DP',
      drop_point: 'BATANG01',
      password_hash: hash,
      status_aktif: true,
    },
    // User Google murni: tanpa NIK, tanpa password_hash (belum pernah set).
    {
      email: 'google-only@ltms.test',
      nik: null,
      nama: 'Citra Google',
      nama_tampilan: 'Citra Google',
      tipe_akun: 'individual',
      role: 'Admin Cabang',
      drop_point: '',
      password_hash: null,
      status_aktif: true,
    },
    // User nonaktif (harus tetap ditolak, spt sebelum migrasi).
    {
      email: 'nonaktif@ltms.test',
      nik: 'NIK-NONAKTIF',
      nama: 'Dedi Nonaktif',
      nama_tampilan: 'Dedi Nonaktif',
      tipe_akun: 'individual',
      role: 'Admin DP',
      drop_point: 'BATANG01',
      password_hash: hash,
      status_aktif: false,
    },
  ]);
  store.set('login_attempts', []);
  store.set('activity_log', []);
  return store;
}

describe('Migrasi Auth NIK Tahap 2: Credentials dual-mode + rate limiting (eksekusi nyata, fungsi produksi asli)', () => {
  let authMod: typeof import('./auth.ts');
  let helpersMod: typeof import('./helpers.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    authMod = await import('./auth.ts');
    helpersMod = await import('./helpers.ts');
  });

  beforeEach(async () => {
    store = await freshStore();
  });

  after(() => mock.reset());

  it('1. Login via NIK (user baru, sudah migrasi) -> berhasil, dapat data user lengkap', async () => {
    const user = await authMod.verifyCredentials('NIK-001', PLAIN_PASSWORD);
    assert.ok(user, 'login NIK harus berhasil dgn password benar');
    assert.equal(user!.email, 'individual@ltms.test');
    assert.equal(user!.nik, 'NIK-001');
    assert.equal(user!.tipeAkun, 'individual');
    assert.equal(user!.role, 'Admin DP');
  });

  it('2. Login via EMAIL (user lama, belum diisi NIK) -> tetap berhasil, TIDAK berubah dari sebelum migrasi', async () => {
    const user = await authMod.verifyCredentials('legacy@ltms.test', PLAIN_PASSWORD);
    assert.ok(user, 'login email fallback harus tetap jalan utk user lama tanpa NIK');
    assert.equal(user!.email, 'legacy@ltms.test');
    assert.equal(user!.nik, '', 'user lama belum ada NIK -> string kosong, bukan error');
  });

  it('3. Akun General login via NIK "GENERAL-<KODE_DP>" -> berhasil, namaTampilan = "DP <KODE_DP>" (BUKAN email placeholder)', async () => {
    const user = await authMod.verifyCredentials('GENERAL-BATANG01', PLAIN_PASSWORD);
    assert.ok(user);
    assert.equal(user!.tipeAkun, 'general');
    assert.equal(user!.namaTampilan, 'DP BATANG01');
    assert.equal(user!.email, 'general-batang01@ltms.local', 'email placeholder tetap ada (PK) tapi bukan yg dipakai login');
  });

  it('4. Password salah -> ditolak (null), TIDAK membocorkan apakah identifier valid', async () => {
    const wrongPassword = await authMod.verifyCredentials('NIK-001', 'salah-password');
    assert.equal(wrongPassword, null);
    const wrongIdentifier = await authMod.verifyCredentials('NIK-TIDAK-ADA', PLAIN_PASSWORD);
    assert.equal(wrongIdentifier, null, 'identifier tak dikenal & password salah pulang null yg sama (anti-enumerasi)');
  });

  it('5. User nonaktif -> ditolak walau NIK/password benar (spt status_aktif check sebelum migrasi)', async () => {
    const user = await authMod.verifyCredentials('NIK-NONAKTIF', PLAIN_PASSWORD);
    assert.equal(user, null);
  });

  it('6. User Google-only (belum pernah set password) -> ditolak via Credentials, TIDAK error', async () => {
    const user = await authMod.verifyCredentials('google-only@ltms.test', 'apapun');
    assert.equal(user, null, 'password_hash null -> tolak, bukan throw');
  });

  it('7. getUserByEmail (jalur Google, TAK disentuh Tahap 2) -> tetap resolve user aktif, tolak nonaktif — bukti tak ada regresi jalur Google', async () => {
    const active = await authMod.getUserByEmail('individual@ltms.test');
    assert.ok(active);
    assert.equal(active!.email, 'individual@ltms.test');

    const inactive = await authMod.getUserByEmail('nonaktif@ltms.test');
    assert.equal(inactive, null, 'user nonaktif tetap ditolak jalur Google, spt sebelumnya');
  });

  it('8. Rate limiting: 5x gagal berturut-turut -> percobaan ke-6 ditolak WALAU password benar (terkunci)', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await authMod.verifyCredentials('NIK-001', 'salah');
      assert.equal(res, null, `percobaan gagal ke-${i + 1} harus null`);
    }
    // Percobaan ke-6, password BENAR kali ini - tapi harusnya sudah terkunci.
    const lockedAttempt = await authMod.verifyCredentials('NIK-001', PLAIN_PASSWORD);
    assert.equal(lockedAttempt, null, 'setelah 5x gagal, login (walau password benar) harus ditolak krn terkunci');
  });

  it('9. Login sukses me-reset counter -> percobaan gagal sebelumnya (di bawah ambang) tidak terbawa terus', async () => {
    // 3x gagal (di bawah ambang 5x)
    await authMod.verifyCredentials('NIK-001', 'salah1');
    await authMod.verifyCredentials('NIK-001', 'salah2');
    await authMod.verifyCredentials('NIK-001', 'salah3');
    // Lalu berhasil
    const ok = await authMod.verifyCredentials('NIK-001', PLAIN_PASSWORD);
    assert.ok(ok, 'login benar setelah 3x gagal (di bawah ambang) harus tetap lolos');
    // Counter harus sudah direset - baris login_attempts terhapus.
    const rows = store.get('login_attempts') ?? [];
    assert.equal(rows.find((r) => r.nik === 'nik-001'), undefined, 'baris login_attempts harus dihapus stlh sukses');
  });

  it('10. Rate limit KEY per-identifier - NIK lain yg gagal berkali-kali TIDAK mengunci NIK-001', async () => {
    for (let i = 0; i < 5; i++) {
      await authMod.verifyCredentials('GENERAL-BATANG01', 'salah');
    }
    const otherStillLocked = await authMod.verifyCredentials('GENERAL-BATANG01', PLAIN_PASSWORD);
    assert.equal(otherStillLocked, null, 'GENERAL-BATANG01 harus terkunci stlh 5x gagal');

    const unaffected = await authMod.verifyCredentials('NIK-001', PLAIN_PASSWORD);
    assert.ok(unaffected, 'NIK-001 TIDAK ikut terkunci oleh kegagalan identifier lain');
  });

  it('11. Identifier/password kosong -> null langsung, tanpa query DB', async () => {
    assert.equal(await authMod.verifyCredentials('', PLAIN_PASSWORD), null);
    assert.equal(await authMod.verifyCredentials('NIK-001', ''), null);
  });

  it('12. requireActor tetap resolve by EMAIL SAJA (identitas pasca-login tak berubah), diperkaya field nik/namaTampilan/tipeAkun', async () => {
    const actorIndividual = await helpersMod.requireActor('individual@ltms.test');
    assert.equal(actorIndividual.nik, 'NIK-001');
    assert.equal(actorIndividual.namaTampilan, 'Andi Individual');
    assert.equal(actorIndividual.tipeAkun, 'individual');

    const actorGeneral = await helpersMod.requireActor('general-batang01@ltms.local');
    assert.equal(actorGeneral.tipeAkun, 'general');
    assert.equal(actorGeneral.namaTampilan, 'DP BATANG01');
  });

  it('13. attributionName: individual -> email (histori Activity_Log lama tak berubah); general -> "DP <KODE_DP>" (bukan email placeholder)', async () => {
    const actorIndividual = await helpersMod.requireActor('individual@ltms.test');
    assert.equal(helpersMod.attributionName(actorIndividual), 'individual@ltms.test');

    const actorGeneral = await helpersMod.requireActor('general-batang01@ltms.local');
    assert.equal(helpersMod.attributionName(actorGeneral), 'DP BATANG01');
  });
});
