/**
 * One-time setup script for LTMS (LongTail Dashboard Management System).
 * Run setupSheets() once from the Apps Script editor (select the function in
 * the toolbar dropdown, then Run). It creates a new Spreadsheet with every
 * sheet required by PRD Bagian 14, with header rows already in place.
 *
 * The created Spreadsheet ID is logged to the execution log (View > Logs)
 * and also written to Script Properties as SPREADSHEET_ID so Code.gs can
 * find it without hardcoding.
 */

function setupSheets() {
  const ss = SpreadsheetApp.create('LTMS - LongTail Dashboard Management System');

  const sheetDefs = [
    {
      name: 'Users',
      headers: ['Nama', 'Email', 'Role', 'Drop Point', 'Password Hash', 'Status Aktif'],
    },
    {
      name: 'LongTail',
      headers: [
        'No. Waybill',
        'Status Terakhir',
        'Alasan Paket Bermasalah',
        'DP Sampai',
        'Waktu Sampai',
        'Umur Paket',
        'Sprinter Delivery',
        'COD',
        'Delivery Attempt',
        'Feedback',
        'Log Feedback',
        'Perlu Review', // Fase 3: ditandai 'Ya' saat waybill yg sudah Clear TTD muncul lagi di import (Bagian 7.1 PRD)
      ],
    },
    {
      // Sama persis dengan LongTail — baris Clear TTD > 30 hari dipindah ke sini (Bagian 3 & 8 PRD).
      name: 'LongTail_Archive',
      headers: [
        'No. Waybill',
        'Status Terakhir',
        'Alasan Paket Bermasalah',
        'DP Sampai',
        'Waktu Sampai',
        'Umur Paket',
        'Sprinter Delivery',
        'COD',
        'Delivery Attempt',
        'Feedback',
        'Log Feedback',
        'Tanggal Arsip',
      ],
    },
    {
      name: 'Master Feedback',
      headers: ['ID', 'Nama Feedback', 'Status Aktif'],
    },
    {
      name: 'Favorite Feedback',
      headers: ['Email Admin DP', 'Nama Feedback', 'Urutan'],
    },
    {
      name: 'Import Batch',
      headers: [
        'Batch ID',
        'Tanggal',
        'Jam',
        'Admin Cabang',
        'Nama File',
        'Total Baris',
        'Berhasil',
        'Gagal',
        'Status',
        'Keterangan',
      ],
    },
    {
      name: 'Activity_Log',
      headers: [
        'User',
        'DP',
        'Waybill',
        'Attempt Ke-',
        'Data Lama',
        'Data Baru',
        'Tanggal',
        'Jam',
        'Sumber Perubahan',
      ],
    },
    {
      // Tidak eksplisit di tabel Bagian 14 PRD, tapi dibutuhkan sebagai master
      // data terpisah oleh Bagian 12 PRD & daftar endpoint CRUD Fase 2/6 prompt.
      name: 'Master Drop Point',
      headers: ['Kode DP', 'Nama DP', 'Wilayah/Cabang', 'Status Aktif'],
    },
    {
      // Fase 3 (Bagian 7.2 PRD): simpan mapping header manual sebagai template
      // reusable. Kolom Mapping berisi JSON {sourceHeader: targetField}.
      name: 'Import Mapping',
      headers: ['Nama Template', 'Mapping', 'Dibuat Oleh', 'Tanggal'],
    },
  ];

  sheetDefs.forEach(function (def, index) {
    const sheet = index === 0 ? ss.getSheets()[0].setName(def.name) : ss.insertSheet(def.name);
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
  });

  // Activity_Log dan LongTail_Archive tidak ditampilkan ke user (Bagian 13 & 14 PRD).
  ss.getSheetByName('Activity_Log').hideSheet();
  ss.getSheetByName('LongTail_Archive').hideSheet();

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  Logger.log('Spreadsheet created: %s', ss.getUrl());
  Logger.log('Spreadsheet ID (saved to Script Properties as SPREADSHEET_ID): %s', ss.getId());
}
