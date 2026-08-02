// Verifikasi PERSISTEN revisi dedup import utk anomali Clear TTD (Masalah 2,
// menggantikan aturan lama "tandai perlu_review, jangan timpa" - PRD 7.1).
// Menjalankan fungsi produksi ASLI (importLongTail) lewat mock.module() pada
// boundary db() saja - pola sama dgn access-control.test.ts.
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { type Row, fakeDbFactory } from './fake-db.test-support.ts';
import type { MappedRow } from '@/lib/import/types';

function freshStore(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  store.set('users', [
    { email: 'admincabang@ltms.test', nama: 'Admin Cabang', role: 'Admin Cabang', drop_point: '', status_aktif: true },
  ]);
  store.set('longtail', [
    {
      no_waybill: 'WB-SALAH-TTD',
      status_terakhir: 'Sudah TTD diterima penerima',
      alasan_bermasalah: '',
      dp_sampai: 'BATANG01',
      waktu_sampai: '2026-07-20 10:00:00',
      umur_frozen: 8, // dibekukan 8 hari saat submit Clear TTD dulu
      sprinter_delivery: 'Budi',
      cod: 'NONCOD',
      delivery_attempt: 1,
      feedback: 'Sudah TTD diterima penerima', // <- ini yg bikin isClearTTD() true
      log_feedback: '20/07/26 : Sudah TTD diterima penerima',
      perlu_review: false,
      version: 3,
    },
    {
      no_waybill: 'WB-NORMAL',
      status_terakhir: 'ON DELIVERY',
      alasan_bermasalah: '',
      dp_sampai: 'BATANG01',
      waktu_sampai: '2026-07-25 10:00:00',
      umur_frozen: null,
      sprinter_delivery: 'Budi',
      cod: 'NONCOD',
      delivery_attempt: 1,
      feedback: 'Reschedule besok pagi', // feedback hari sebelumnya
      log_feedback: '25/07/26 : Reschedule besok pagi',
      perlu_review: false,
      version: 1,
    },
  ]);
  store.set('activity_log', []);
  store.set('longtail_archive', []);
  store.set('import_batch', []);
  return store;
}

const ADMIN_CABANG = 'admincabang@ltms.test';

describe('Revisi dedup import: anomali Clear TTD & reset feedback harian', () => {
  let importLib: typeof import('./import.ts');
  let store: Map<string, Row[]>;

  before(async () => {
    mock.module('./client', {
      namedExports: { db: fakeDbFactory(() => store) },
    });
    importLib = await import('./import.ts');
  });

  beforeEach(() => {
    store = freshStore();
  });

  after(() => mock.reset());

  it('waybill Clear TTD MUNCUL LAGI di tarikan dgn status baru -> ditimpa (BUKAN perlu_review), umur resume, Feedback dikosongkan', async () => {
    const rows: MappedRow[] = [
      {
        noWaybill: 'WB-SALAH-TTD',
        statusTerakhir: 'ON DELIVERY', // status tracking BARU dari kurir - bukti kuat salah tandai Clear TTD
        alasanBermasalah: '',
        dpSampai: 'BATANG01',
        waktuSampai: '2026-07-29 10:00:00', // waktu_sampai TERBARU dari tarikan
        sprinterDelivery: 'Budi',
        cod: 'NONCOD',
        deliveryAttempt: 2,
      },
    ];

    const result = await importLib.importLongTail(ADMIN_CABANG, 'tarikan-koreksi.xlsx', rows);

    assert.equal(result.koreksiOtomatis, 1, 'harus terhitung sbg koreksi otomatis, bukan update biasa');
    assert.equal(result.updated, 0);

    const dbRow = store.get('longtail')!.find((r) => r.no_waybill === 'WB-SALAH-TTD')!;
    assert.equal(dbRow.status_terakhir, 'ON DELIVERY', 'status_terakhir ditimpa dgn data tarikan terbaru');
    assert.equal(dbRow.waktu_sampai, '2026-07-29 10:00:00', 'waktu_sampai ditimpa (dasar resume umur live)');
    assert.equal(dbRow.delivery_attempt, 2, 'field tracking lain ikut ditimpa spt update biasa');
    assert.equal(dbRow.umur_frozen, null, 'freeze dilepas - umur resume live dari waktu_sampai baru');
    assert.equal(dbRow.feedback, '', 'Feedback dikosongkan supaya isClearTTD() balik false (konsisten di badge/alert/dashboard)');
    assert.equal(dbRow.perlu_review, false, 'perlu_review TIDAK dipakai lagi utk jalur ini (aturan lama dihapus)');

    const log = store.get('activity_log')!.find((r) => r.waybill === 'WB-SALAH-TTD')!;
    assert.equal(log.data_lama, 'Clear TTD');
    assert.equal(log.data_baru, 'ON DELIVERY', 'Data Baru = status baru dari import');
    assert.equal(log.sumber, 'Koreksi Otomatis (tidak konsisten dengan tarikan)');
  });

  it('waybill NON-Clear-TTD di-update: feedback harian direset kosong, log_feedback riwayat tetap utuh', async () => {
    const rows: MappedRow[] = [
      {
        noWaybill: 'WB-NORMAL',
        statusTerakhir: 'RESCHEDULE',
        dpSampai: 'BATANG01',
        deliveryAttempt: 2,
      },
    ];

    const result = await importLib.importLongTail(ADMIN_CABANG, 'tarikan-biasa.xlsx', rows);

    assert.equal(result.updated, 1);
    assert.equal(result.koreksiOtomatis, 0);

    const dbRow = store.get('longtail')!.find((r) => r.no_waybill === 'WB-NORMAL')!;
    assert.equal(dbRow.status_terakhir, 'RESCHEDULE');
    assert.equal(dbRow.delivery_attempt, 2);
    assert.equal(dbRow.feedback, '', 'Feedback direset kosong agar Admin DP bisa isi follow-up hari ini');
    assert.equal(dbRow.log_feedback, '25/07/26 : Reschedule besok pagi', 'Riwayat Log Feedback lama tetap utuh');

    const log = store.get('activity_log')!.find((r) => r.waybill === 'WB-NORMAL')!;
    assert.equal(log.sumber, 'Auto-update Import');
  });

  it('waybill baru (belum ada di LongTail) tetap ter-insert normal', async () => {
    const rows: MappedRow[] = [
      { noWaybill: 'WB-BARU', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' },
    ];
    const result = await importLib.importLongTail(ADMIN_CABANG, 'tarikan-baru.xlsx', rows);
    assert.equal(result.inserted, 1);
    const dbRow = store.get('longtail')!.find((r) => r.no_waybill === 'WB-BARU')!;
    assert.equal(dbRow.status_terakhir, 'ON DELIVERY');
    assert.equal(dbRow.perlu_review, false);
  });

  describe('previewImport (read-only calculation)', () => {
    it('menghitung estimasi import dan potensi Auto-Close tanpa memodifikasi database', async () => {
      // Di DP BATANG01 ada 2 waybill aktif di DB: WB-SALAH-TTD (Clear TTD) dan WB-NORMAL (non-Clear TTD).
      // Jika kita kirim tarikan berisi HANYA WB-BARU untuk BATANG01:
      // Maka WB-SALAH-TTD dan WB-NORMAL akan diproyeksikan ter-Auto-Close (1 Clear TTD, 1 Close Alur).
      const rows: MappedRow[] = [
        { noWaybill: 'WB-BARU', statusTerakhir: 'ON DELIVERY', dpSampai: 'BATANG01' },
      ];

      const initialLtCount = store.get('longtail')!.length;
      const initialArchiveCount = store.get('longtail_archive')!.length;
      const initialLogCount = store.get('activity_log')!.length;

      const preview = await importLib.previewImport(ADMIN_CABANG, 'tarikan-kecil.xlsx', rows);

      assert.equal(preview.total, 1);
      assert.equal(preview.inserted, 1);
      assert.equal(preview.updated, 0);
      assert.equal(preview.koreksiOtomatis, 0);
      assert.equal(preview.autoClose.total, 2, '2 waybill lama di BATANG01 tidak ada di tarikan -> terhitung Auto-Close');
      assert.equal(preview.autoClose.clearTTD, 1);
      assert.equal(preview.autoClose.closeAlur, 1);
      assert.equal(preview.autoClose.perDp.length, 1);
      assert.equal(preview.autoClose.perDp[0].dp, 'BATANG01');
      assert.equal(preview.autoClose.perDp[0].count, 2);

      // Verifikasi Read-Only: store DB tidak boleh berubah sama sekali
      assert.equal(store.get('longtail')!.length, initialLtCount, 'longtail tidak boleh termutasi');
      assert.equal(store.get('longtail_archive')!.length, initialArchiveCount, 'archive tidak boleh termutasi');
      assert.equal(store.get('activity_log')!.length, initialLogCount, 'activity_log tidak boleh termutasi');
    });
  });
});
