// Verifikasi PERSISTEN: "Data Long Tail terakhir di-import" HARUS dibaca dari
// import_batch (waktu import sungguhan), BUKAN entri Activity_Log terakhir
// apa pun (yg sebelumnya bisa jadi submit feedback manual - membingungkan
// krn label ini seharusnya spesifik soal kapan data ditarik ulang, bukan
// aktivitas apa pun). Fungsi produksi asli via mock.module pada boundary
// db() - pola sama dgn test lain di sesi ini.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
    { email: 'admindp@ltms.test', nama: 'Admin DP', role: 'Admin DP', drop_point: 'BATANG01', status_aktif: true },
  ]);
  store.set('import_batch', []);
  store.set('activity_log', []);
  return store;
}

describe('getLastUpdate: waktu import Data Long Tail terakhir (eksekusi nyata, fungsi produksi asli)', () => {
  let meta: typeof import('./meta.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    meta = await import('./meta.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('belum pernah ada import sama sekali -> hasUpdate: false, walau Activity_Log punya entri feedback manual', async () => {
    store.set('activity_log', [
      { id: 1, user_email: 'admindp@ltms.test', dp: 'BATANG01', waybill: 'WB-A', attempt_ke: 1, data_lama: '', data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: '2026-07-30T10:00:00+07:00' },
    ]);
    const result = await meta.getLastUpdate('admincabang@ltms.test');
    assert.deepEqual(result, { hasUpdate: false });
  });

  it('ada 1 batch import -> hasUpdate: true, tanggal/jam dari import_batch.created_at', async () => {
    store.set('import_batch', [
      { batch_id: 'B1', admin_cabang: 'admincabang@ltms.test', nama_file: 'tarikan.xlsx', total_baris: 10, berhasil: 10, gagal: 0, status: 'Sukses', keterangan: '', created_at: '2026-07-28T09:15:30+07:00' },
    ]);
    const result = await meta.getLastUpdate('admincabang@ltms.test');
    assert.equal(result.hasUpdate, true);
    if (result.hasUpdate) {
      assert.equal(result.tanggal, '28/07/26');
      assert.equal(result.jam, '09:15:30');
    }
  });

  it('feedback manual TERBARU setelah import TIDAK boleh ikut dianggap "update" - hanya waktu import yg dipakai', async () => {
    store.set('import_batch', [
      { batch_id: 'B1', admin_cabang: 'admincabang@ltms.test', nama_file: 'tarikan.xlsx', total_baris: 10, berhasil: 10, gagal: 0, status: 'Sukses', keterangan: '', created_at: '2026-07-20T08:00:00+07:00' },
    ]);
    // Feedback manual jauh LEBIH BARU drpd import - kalau bug regresi ke
    // logic lama (baca Activity_Log terbaru), test ini akan gagal krn
    // tanggal yg terbaca jadi tanggal feedback, bukan tanggal import.
    store.set('activity_log', [
      { id: 1, user_email: 'admindp@ltms.test', dp: 'BATANG01', waybill: 'WB-A', attempt_ke: 1, data_lama: '', data_baru: 'On Delivery', sumber: 'Manual Feedback', created_at: '2026-07-30T15:00:00+07:00' },
    ]);
    const result = await meta.getLastUpdate('admincabang@ltms.test');
    assert.equal(result.hasUpdate, true);
    if (result.hasUpdate) assert.equal(result.tanggal, '20/07/26', 'harus tanggal IMPORT (20/07), bukan tanggal feedback manual (30/07)');
  });

  it('ambil batch import PALING BARU kalau ada lebih dari satu', async () => {
    store.set('import_batch', [
      { batch_id: 'B1', admin_cabang: 'admincabang@ltms.test', nama_file: 'a.xlsx', total_baris: 5, berhasil: 5, gagal: 0, status: 'Sukses', keterangan: '', created_at: '2026-07-10T08:00:00+07:00' },
      { batch_id: 'B2', admin_cabang: 'admincabang@ltms.test', nama_file: 'b.xlsx', total_baris: 5, berhasil: 5, gagal: 0, status: 'Sukses', keterangan: '', created_at: '2026-07-29T14:30:00+07:00' },
    ]);
    const result = await meta.getLastUpdate('admincabang@ltms.test');
    assert.equal(result.hasUpdate, true);
    if (result.hasUpdate) assert.equal(result.tanggal, '29/07/26');
  });

  it('waktu import GLOBAL - Admin DP melihat hasil yg SAMA dgn Admin Cabang (import tak di-scope per DP)', async () => {
    store.set('import_batch', [
      { batch_id: 'B1', admin_cabang: 'admincabang@ltms.test', nama_file: 'tarikan.xlsx', total_baris: 10, berhasil: 10, gagal: 0, status: 'Sukses', keterangan: '', created_at: '2026-07-28T09:15:30+07:00' },
    ]);
    const cabang = await meta.getLastUpdate('admincabang@ltms.test');
    const dp = await meta.getLastUpdate('admindp@ltms.test');
    assert.deepEqual(cabang, dp);
  });
});
