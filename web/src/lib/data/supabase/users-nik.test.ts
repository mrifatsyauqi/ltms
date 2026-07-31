// Verifikasi PERSISTEN Langkah 4 migrasi auth NIK: field NIK di User
// Management + Akun General per-DP. Menjalankan fungsi PRODUKSI ASLI
// (createUser, updateUser, listUsers, createGeneralAccount) lewat
// mock.module() pada boundary db() saja - pola sama dgn access-control.test.ts.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { email: 'admincabang@ltms.test', nik: 'NIK-CABANG', nama: 'Admin Cabang', nama_tampilan: 'Admin Cabang', tipe_akun: 'individual', role: 'Admin Cabang', drop_point: '', status_aktif: true },
    { email: 'admindp@ltms.test', nik: null, nama: 'Admin DP Lama', nama_tampilan: 'Admin DP Lama', tipe_akun: 'individual', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
  ]);
  store.set('master_drop_point', [
    { kode_dp: 'BATANG01', nama_dp: 'Batang 01', wilayah: 'Batang', status_aktif: true },
    { kode_dp: 'SUBAH01', nama_dp: 'Subah 01', wilayah: 'Batang', status_aktif: true },
  ]);
  return store;
}

const ADMIN_CABANG = 'admincabang@ltms.test';
const ADMIN_DP = 'admindp@ltms.test';

describe('Migrasi Auth NIK Tahap 4: User Management (NIK) + Akun General per-DP (eksekusi nyata, fungsi produksi asli)', () => {
  let users: typeof import('./users.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    users = await import('./users.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('1. createUser TANPA nik -> VALIDATION_ERROR (NIK wajib diisi)', async () => {
    await assert.rejects(
      () => users.createUser(ADMIN_CABANG, { nama: 'Budi', email: 'budi@ltms.test', nik: '', role: 'Admin DP', dropPoint: 'BATANG01' }),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('2. createUser dgn NIK yang SUDAH DIPAKAI user lain -> CONFLICT "NIK sudah dipakai user lain"', async () => {
    await assert.rejects(
      () =>
        users.createUser(ADMIN_CABANG, {
          nama: 'Budi',
          email: 'budi-baru@ltms.test',
          nik: 'NIK-CABANG', // sudah dipakai admincabang@ltms.test
          role: 'Admin DP',
          dropPoint: 'BATANG01',
        }),
      (e: unknown) => {
        const err = e as { code?: string; message?: string };
        return err.code === 'CONFLICT' && err.message === 'NIK sudah dipakai user lain';
      },
    );
  });

  it('3. createUser dgn EMAIL yang sudah terdaftar (NIK baru & unik) -> CONFLICT "Email sudah terdaftar" (dibedakan dari konflik NIK)', async () => {
    await assert.rejects(
      () =>
        users.createUser(ADMIN_CABANG, {
          nama: 'Duplikat',
          email: 'admincabang@ltms.test', // email sudah ada
          nik: 'NIK-BARU-UNIK',
          role: 'Admin Cabang',
        }),
      (e: unknown) => {
        const err = e as { code?: string; message?: string };
        return err.code === 'CONFLICT' && err.message === 'Email sudah terdaftar';
      },
    );
  });

  it('4. createUser berhasil -> tersimpan dgn tipe_akun individual & nama_tampilan = nama', async () => {
    await users.createUser(ADMIN_CABANG, { nama: 'Citra', email: 'citra@ltms.test', nik: 'NIK-CITRA', role: 'Admin DP', dropPoint: 'SUBAH01' });
    const list = await users.listUsers(ADMIN_CABANG);
    const row = list.find((u) => u.Email === 'citra@ltms.test');
    assert.ok(row);
    assert.equal(row!.NIK, 'NIK-CITRA');
    assert.equal(row!['Tipe Akun'], 'individual');
  });

  it('5. updateUser: mengisi NIK pertama kali utk user lama (nik null) -> berhasil (skenario Langkah 5 manual)', async () => {
    const updated = await users.updateUser(ADMIN_CABANG, ADMIN_DP, { nik: 'NIK-ADMINDP-BARU' });
    assert.equal(updated.NIK, 'NIK-ADMINDP-BARU');
  });

  it('6. updateUser: NIK dikirim string kosong -> VALIDATION_ERROR (tak boleh dikosongkan lewat edit)', async () => {
    await assert.rejects(
      () => users.updateUser(ADMIN_CABANG, ADMIN_DP, { nik: '' }),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });

  it('7. updateUser: NIK diisi dgn nilai yg SUDAH dipakai user lain -> CONFLICT', async () => {
    await assert.rejects(
      () => users.updateUser(ADMIN_CABANG, ADMIN_DP, { nik: 'NIK-CABANG' }),
      (e: unknown) => (e as { code?: string }).code === 'CONFLICT',
    );
  });

  it('8. createGeneralAccount: NIK "GENERAL-<KODE_DP>", namaTampilan "DP <KODE_DP>", email placeholder (bukan personal)', async () => {
    const result = await users.createGeneralAccount(ADMIN_CABANG, 'BATANG01', 'scrypt-hash-dummy');
    assert.equal(result.nik, 'GENERAL-BATANG01');
    assert.equal(result.namaTampilan, 'DP BATANG01');
    assert.equal(result.email, 'general-batang01@ltms.local');

    const list = await users.listUsers(ADMIN_CABANG);
    const row = list.find((u) => u.NIK === 'GENERAL-BATANG01');
    assert.ok(row);
    assert.equal(row!['Tipe Akun'], 'general');
    assert.equal(row!.Role, 'Admin DP');
    assert.equal(row!['Drop Point'], 'BATANG01');
  });

  it('9. createGeneralAccount DUA KALI utk DP yang sama -> CONFLICT (satu akun General per DP)', async () => {
    await users.createGeneralAccount(ADMIN_CABANG, 'BATANG01', 'hash1');
    await assert.rejects(
      () => users.createGeneralAccount(ADMIN_CABANG, 'BATANG01', 'hash2'),
      (e: unknown) => (e as { code?: string }).code === 'CONFLICT',
    );
  });

  it('10. createGeneralAccount oleh Admin DP -> FORBIDDEN (hanya Admin Cabang)', async () => {
    await assert.rejects(
      () => users.createGeneralAccount(ADMIN_DP, 'BATANG01', 'hash'),
      (e: unknown) => (e as { code?: string }).code === 'FORBIDDEN',
    );
  });

  it('11. createGeneralAccount tanpa passwordHash -> VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => users.createGeneralAccount(ADMIN_CABANG, 'BATANG01', ''),
      (e: unknown) => (e as { code?: string }).code === 'VALIDATION_ERROR',
    );
  });
});
