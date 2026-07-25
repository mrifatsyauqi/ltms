/**
 * LTMS REST API layer (Google Apps Script Web App), fronting Google Sheets.
 *
 * Fase 1: `getUserByEmail` via doGet - used by NextAuth to resolve a signed-in
 * Google account to its LTMS role + Drop Point (role ditentukan dari sheet
 * Users, bukan dari klaim sisi client).
 *
 * Fase 2: doPost dispatcher (ROUTES_) with basic CRUD for LongTail, Users,
 * Master Drop Point, Master Feedback, Favorite Feedback. Every call carries
 * the caller's `email`, re-resolved against the `Users` sheet server-side on
 * every request (never trusts a client-claimed role) - this is what
 * satisfies "Admin DP hanya boleh melihat data DP miliknya, divalidasi di
 * level API" (PRD Bagian 5). Every write goes through `withLock_`
 * (LockService.getScriptLock) so import and feedback auto-save can never
 * corrupt each other (PRD Bagian 7.3 / prompt Bagian 3.5).
 *
 * Deploy as Web App (Execute as: Me, Who has access: Anyone) - see README.md
 * in this folder. Redeploy (Deploy > Manage deployments > Edit > New version)
 * whenever this file changes.
 */

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (!isAuthorized_(params)) {
    return jsonResponse_({ ok: false, error: 'unauthorized' });
  }

  const action = params.action;

  if (action === 'getUserByEmail') {
    return handleGetUserByEmail_(params);
  }

  return jsonResponse_({ ok: false, error: 'unknown_action' });
}

function handleGetUserByEmail_(params) {
  const email = (params.email || '').trim().toLowerCase();
  if (!email) {
    return jsonResponse_({ ok: false, error: 'missing_email' });
  }

  const sheet = getSpreadsheet_().getSheetByName('Users');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const col = {
    nama: headers.indexOf('Nama'),
    email: headers.indexOf('Email'),
    role: headers.indexOf('Role'),
    dropPoint: headers.indexOf('Drop Point'),
    statusAktif: headers.indexOf('Status Aktif'),
  };

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[col.email]).trim().toLowerCase() === email) {
      return jsonResponse_({
        ok: true,
        found: true,
        user: {
          nama: row[col.nama],
          email: row[col.email],
          role: row[col.role],
          dropPoint: row[col.dropPoint],
          statusAktif: row[col.statusAktif] === true || String(row[col.statusAktif]).toLowerCase() === 'aktif',
        },
      });
    }
  }

  return jsonResponse_({ ok: true, found: false, user: null });
}

// ============================================================================
// Fase 2 - doPost dispatcher
// ============================================================================

function doPost(e) {
  let params;
  try {
    params = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (parseErr) {
    return jsonResponse_({ ok: false, error: 'INVALID_JSON' });
  }

  if (!isAuthorized_(params)) {
    return jsonResponse_({ ok: false, error: 'UNAUTHORIZED' });
  }

  const handler = ROUTES_[params.action];
  if (!handler) {
    return jsonResponse_({ ok: false, error: 'UNKNOWN_ACTION' });
  }

  try {
    const data = handler(params);
    return jsonResponse_({ ok: true, data: data });
  } catch (err) {
    if (err && err.code) {
      var payload = { ok: false, error: err.code, message: err.message };
      if (err.data !== undefined) payload.data = err.data; // mis. baris terkini utk VERSION_CONFLICT
      return jsonResponse_(payload);
    }
    return jsonResponse_({ ok: false, error: 'INTERNAL_ERROR', message: String(err && err.message ? err.message : err) });
  }
}

const LOCK_TIMEOUT_MS_ = 10000;

/** Serializes every write across the whole script - this is the mutual exclusion required by PRD Bagian 7.3 (Import vs Auto Save feedback, etc). */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS_);
  } catch (waitErr) {
    throw { code: 'LOCK_TIMEOUT', message: 'Sistem sedang memproses perubahan lain, coba lagi sebentar.' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// Generic sheet/table helpers
// ----------------------------------------------------------------------------

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) {
    throw { code: 'SHEET_NOT_FOUND', message: 'Sheet ' + name + ' tidak ditemukan' };
  }
  return sheet;
}

/** Jumlah baris data (tanpa header) di sebuah sheet. */
function countSheetData_(sheetName) {
  var lastRow = getSheet_(sheetName).getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}

/** Hapus semua baris data (baris 2..bawah), header baris 1 tetap. Kembalikan jumlah yang dihapus. */
function clearSheetData_(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  sheet.deleteRows(2, lastRow - 1);
  return lastRow - 1;
}

/** Reads a sheet into {sheet, headers, rows}; each row is an object keyed by header, plus __row (1-based sheet row number). Blank rows are skipped. */
function readTable_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    const isBlank = raw.every(function (cell) { return cell === '' || cell === null; });
    if (isBlank) continue;
    const obj = {};
    headers.forEach(function (h, idx) { obj[h] = raw[idx]; });
    obj.__row = i + 1;
    rows.push(obj);
  }
  return { sheet: sheet, headers: headers, rows: rows };
}

function stripRow_(row) {
  const clone = {};
  Object.keys(row).forEach(function (k) {
    if (k !== '__row') clone[k] = row[k];
  });
  return clone;
}

function appendRow_(sheetName, obj) {
  const table = readTable_(sheetName);
  const row = table.headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  table.sheet.appendRow(row);
  return obj;
}

function updateRowByKey_(sheetName, keyCol, keyVal, patch) {
  const table = readTable_(sheetName);
  const target = table.rows.find(function (r) {
    return String(r[keyCol]).trim().toLowerCase() === String(keyVal).trim().toLowerCase();
  });
  if (!target) {
    throw { code: 'NOT_FOUND', message: keyCol + ' "' + keyVal + '" tidak ditemukan' };
  }
  const merged = Object.assign({}, target, patch);
  const rowArray = table.headers.map(function (h) { return merged[h] !== undefined ? merged[h] : ''; });
  table.sheet.getRange(target.__row, 1, 1, table.headers.length).setValues([rowArray]);
  return stripRow_(merged);
}

function deleteRowByKey_(sheetName, keyCol, keyVal) {
  const table = readTable_(sheetName);
  const target = table.rows.find(function (r) {
    return String(r[keyCol]).trim().toLowerCase() === String(keyVal).trim().toLowerCase();
  });
  if (!target) {
    throw { code: 'NOT_FOUND', message: keyCol + ' "' + keyVal + '" tidak ditemukan' };
  }
  table.sheet.deleteRow(target.__row);
}

function isActive_(statusAktifValue) {
  return String(statusAktifValue).trim().toLowerCase() === 'aktif';
}

/**
 * Sinyal Clear TTD (dikonfirmasi user): sebuah baris dianggap Clear TTD jika
 * kolom Feedback (isian terkini) memuat kata "TTD" - mencakup "CLEAR TTD"
 * maupun "TTD" saja. Dipakai untuk dedup import (Bagian 7.1) & freeze Umur
 * Paket (Bagian 9.1). BUKAN berdasarkan Status Terakhir.
 */
function isClearTTDFeedback_(feedback) {
  return /\bTTD\b/i.test(String(feedback == null ? '' : feedback));
}

/**
 * Kategori Distribusi Feedback (Bagian 8 PRD) untuk snapshot per paket -
 * dihitung dari kolom Feedback terkini, bukan parsing Log Feedback. Cocokkan
 * kata kunci umum; yang tidak dikenal -> 'Lainnya'; kosong -> 'Belum Feedback'.
 */
function categorizeFeedback_(feedback) {
  var f = String(feedback == null ? '' : feedback).trim();
  if (f === '') return 'Belum Feedback';
  if (isClearTTDFeedback_(f)) return 'Clear TTD';
  var u = f.toUpperCase();
  if (u.indexOf('ON DELIVERY') !== -1 || u.indexOf('ONDELIVERY') !== -1) return 'On Delivery';
  if (u.indexOf('RESCHEDULE') !== -1) return 'Reschedule';
  if (u.indexOf('TIDAK DI TEMPAT') !== -1 || u.indexOf('PENERIMA TIDAK') !== -1) return 'Penerima Tidak Di Tempat';
  if (u.indexOf('ALAMAT') !== -1) return 'Alamat Tidak Ditemukan';
  return 'Lainnya';
}

/**
 * Client mengirim Date sebagai string ISO 8601 (hasil JSON.stringify dari
 * objek Date yang di-parse SheetJS dengan cellDates:true). String ISO tidak
 * ambigu (tahun dulu), jadi aman dikonversi jadi Date asli di sini sebelum
 * ditulis ke sel - supaya sel tersimpan sebagai tanggal beneran (bukan teks)
 * dan tidak bergantung pada locale/auto-parse Google Sheets yang bisa salah
 * tafsir DD/MM vs MM/DD.
 */
function toDateIfIso_(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    var d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

const MS_PER_DAY_ = 24 * 60 * 60 * 1000;

/**
 * Umur Paket (Bagian 9.1 PRD) = Hari Ini - Waktu Sampai, dalam hari.
 * Perhitungan BERHENTI (frozen) saat Clear TTD: begitu kolom Feedback berisi
 * 'TTD', nilai Umur dibekukan pada angka yang tersimpan di sel 'Umur Paket'
 * (ditulis oleh submitFeedback saat transisi ke Clear TTD). Untuk baris yang
 * belum Clear TTD, Umur dihitung live setiap dibaca (sel 'Umur Paket' dibiarkan
 * kosong). Mengembalikan angka hari (>=0) atau '' jika Waktu Sampai tak valid.
 */
function computeUmur_(row) {
  var frozen = row['Umur Paket'];
  if (isClearTTDFeedback_(row['Feedback'])) {
    // Sudah Clear TTD: pakai nilai beku bila ada; kalau kosong (mis. data lama),
    // hitung sekali sebagai fallback terbaik.
    if (frozen !== '' && frozen != null && !isNaN(Number(frozen))) return Number(frozen);
  }
  var ws = row['Waktu Sampai'];
  var d = ws instanceof Date ? ws : (ws ? new Date(ws) : null);
  if (!d || isNaN(d.getTime())) return frozen !== '' && frozen != null ? frozen : '';
  var today = new Date();
  var diff = Math.floor((today.getTime() - d.getTime()) / MS_PER_DAY_);
  return diff < 0 ? 0 : diff;
}

/**
 * Versi baris untuk optimistic locking (Bagian 9.4). Sentinel = Feedback +
 * Log Feedback, dua-duanya field yang berubah saat feedback disubmit. Kalau
 * versi client != versi server saat menyimpan, berarti ada perubahan lain di
 * antaranya -> tolak agar tidak menimpa diam-diam.
 */
function rowVersion_(row) {
  return String(row['Feedback'] == null ? '' : row['Feedback']) + ' ' + String(row['Log Feedback'] == null ? '' : row['Log Feedback']);
}

/** Membungkus baris LongTail utk dikirim ke client: Umur Paket dihitung/dibekukan + flag turunan + version token. */
function decorateLongTailRow_(row) {
  var clean = stripRow_(row);
  clean['Umur Paket'] = computeUmur_(row);
  clean['__isClearTTD'] = isClearTTDFeedback_(row['Feedback']);
  clean['__version'] = rowVersion_(row);
  return clean;
}

/** Hitung attempt berikutnya untuk sebuah waybill = jumlah baris Activity_Log dgn waybill itu + 1. */
function nextAttempt_(waybill) {
  var sheet = getSheet_('Activity_Log');
  var values = sheet.getDataRange().getValues();
  var wbIdx = values[0].indexOf('Waybill');
  var needle = String(waybill).trim().toLowerCase();
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][wbIdx]).trim().toLowerCase() === needle) count++;
  }
  return count + 1;
}

/** Menambahkan kolom header di akhir sheet jika belum ada; mengembalikan indeks 0-based kolomnya. */
function ensureColumn_(sheetName, columnName) {
  const sheet = getSheet_(sheetName);
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = headers.indexOf(columnName);
  if (idx !== -1) return idx;
  sheet.getRange(1, lastCol + 1).setValue(columnName).setFontWeight('bold');
  return lastCol; // 0-based index kolom baru
}

/** Membuat sheet dengan header jika belum ada. */
function ensureSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return sheet;
}

/** Idempotent: pastikan skema pendukung import ada tanpa perlu re-run setup / tanpa hapus data lama. */
function ensureImportInfrastructure_() {
  ensureColumn_('LongTail', 'Perlu Review');
  ensureSheet_('Import Mapping', ['Nama Template', 'Mapping', 'Dibuat Oleh', 'Tanggal']);
}

function nowParts_() {
  const tz = Session.getScriptTimeZone();
  return {
    tanggal: Utilities.formatDate(new Date(), tz, 'dd/MM/yy'),
    jam: Utilities.formatDate(new Date(), tz, 'HH:mm:ss'),
  };
}

/**
 * Jam ditulis sbg string "HH:mm:ss" tapi Google Sheets meng-coerce-nya jadi
 * nilai waktu -> getValues() mengembalikannya sbg Date (epoch 1899). Format
 * balik ke HH:mm:ss saat dibaca supaya tidak muncul "Sat Dec 30 1899 ...".
 */
function formatJam_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm:ss');
  }
  return String(value == null ? '' : value);
}

/**
 * Tanggal di Activity_Log ditulis sbg teks 'dd/MM/yy'. Google Sheets kadang
 * meng-coerce-nya jadi Date, jadi terima dua-duanya. Mengembalikan objek Date
 * (tengah hari, supaya perbandingan rentang tidak terganggu timezone) atau null.
 */
function parseTanggal_(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0);
  }
  var s = String(value == null ? '' : value).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  var dd = Number(m[1]);
  var mm = Number(m[2]);
  var yy = Number(m[3]);
  if (yy < 100) yy += 2000;
  return new Date(yy, mm - 1, dd, 12, 0, 0);
}

/** Parse 'YYYY-MM-DD' dari client jadi Date lokal (bukan UTC, supaya tidak geser sehari). */
function parseIsoDate_(s) {
  var m = String(s == null ? '' : s).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Tampilkan tanggal konsisten sbg dd/MM/yy apa pun bentuk aslinya di sel. */
function formatTanggal_(value) {
  var d = parseTanggal_(value);
  if (!d) return String(value == null ? '' : value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yy');
}

function appendActivityLog_(entry) {
  appendRow_('Activity_Log', {
    'User': entry.user || '',
    'DP': entry.dp || '',
    'Waybill': entry.waybill || '',
    'Attempt Ke-': entry.attempt || '',
    'Data Lama': entry.dataLama || '',
    'Data Baru': entry.dataBaru || '',
    'Tanggal': entry.tanggal,
    'Jam': entry.jam,
    'Sumber Perubahan': entry.sumber || '',
  });
}

// ----------------------------------------------------------------------------
// Actor resolution & authorization (re-derived from Users sheet every call)
// ----------------------------------------------------------------------------

function getActor_(email) {
  if (!email) return null;
  const table = readTable_('Users');
  const needle = String(email).trim().toLowerCase();
  const found = table.rows.find(function (r) { return String(r['Email']).trim().toLowerCase() === needle; });
  if (!found || !isActive_(found['Status Aktif'])) return null;
  return {
    nama: found['Nama'],
    email: found['Email'],
    role: found['Role'],
    dropPoint: found['Drop Point'],
  };
}

function requireActor_(params) {
  const actor = getActor_(params.email);
  if (!actor) {
    throw { code: 'UNAUTHENTICATED', message: 'User tidak dikenali atau nonaktif di sheet Users' };
  }
  return actor;
}

function requireRole_(actor, roles) {
  if (roles.indexOf(actor.role) === -1) {
    throw { code: 'FORBIDDEN', message: 'Role ' + actor.role + ' tidak diizinkan untuk aksi ini' };
  }
}

function assertDropPointActive_(kodeDp) {
  const table = readTable_('Master Drop Point');
  const dp = table.rows.find(function (r) { return String(r['Kode DP']).trim().toLowerCase() === String(kodeDp).trim().toLowerCase(); });
  if (!dp) {
    throw { code: 'VALIDATION_ERROR', message: 'Drop Point "' + kodeDp + '" tidak ditemukan' };
  }
  if (!isActive_(dp['Status Aktif'])) {
    throw { code: 'VALIDATION_ERROR', message: 'Drop Point "' + kodeDp + '" tidak aktif' };
  }
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const ROUTES_ = {
  // ---- Users (Admin Cabang only; Bagian 12 PRD - hanya tambah/update, tidak hard-delete) ----
  listUsers: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    // Password Hash sengaja tidak pernah dikirim ke client (dipakai internal saja).
    return readTable_('Users').rows.map(function (row) {
      const clean = stripRow_(row);
      delete clean['Password Hash'];
      return clean;
    });
  },

  createUser: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const payload = params.data || {};
    if (!payload.nama || !payload.email || !payload.role) {
      throw { code: 'VALIDATION_ERROR', message: 'nama, email, role wajib diisi' };
    }
    if (['Admin Cabang', 'Admin DP'].indexOf(payload.role) === -1) {
      throw { code: 'VALIDATION_ERROR', message: 'role harus "Admin Cabang" atau "Admin DP"' };
    }
    if (payload.role === 'Admin DP') {
      if (!payload.dropPoint) {
        throw { code: 'VALIDATION_ERROR', message: 'Admin DP wajib dikaitkan ke minimal satu Drop Point' };
      }
      assertDropPointActive_(payload.dropPoint);
    }
    return withLock_(function () {
      const table = readTable_('Users');
      const exists = table.rows.some(function (r) { return String(r['Email']).trim().toLowerCase() === String(payload.email).trim().toLowerCase(); });
      if (exists) throw { code: 'CONFLICT', message: 'Email sudah terdaftar' };
      appendRow_('Users', {
        'Nama': payload.nama,
        'Email': payload.email,
        'Role': payload.role,
        'Drop Point': payload.dropPoint || '',
        'Status Aktif': 'Aktif',
      });
      return { email: payload.email };
    });
  },

  updateUser: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const targetEmail = params.targetEmail;
    const payload = params.data || {};
    if (!targetEmail) throw { code: 'VALIDATION_ERROR', message: 'targetEmail wajib diisi' };
    if (payload.role === 'Admin DP') {
      if (!payload.dropPoint) {
        throw { code: 'VALIDATION_ERROR', message: 'Admin DP wajib dikaitkan ke minimal satu Drop Point' };
      }
      assertDropPointActive_(payload.dropPoint);
    }
    const patch = {};
    if (payload.nama !== undefined) patch['Nama'] = payload.nama;
    if (payload.role !== undefined) patch['Role'] = payload.role;
    // Role Admin Cabang -> DP dikosongkan (cakupan semua DP, keputusan user).
    if (payload.role === 'Admin Cabang') patch['Drop Point'] = '';
    else if (payload.dropPoint !== undefined) patch['Drop Point'] = payload.dropPoint;
    if (payload.statusAktif !== undefined) patch['Status Aktif'] = payload.statusAktif ? 'Aktif' : 'Nonaktif';
    return withLock_(function () {
      return updateRowByKey_('Users', 'Email', targetEmail, patch);
    });
  },

  // Hapus user (di luar PRD Bagian 12 yg hanya menonaktifkan; ditambah atas
  // permintaan user). Admin Cabang tak bisa menghapus akunnya sendiri.
  deleteUser: function (params) {
    const actor = requireActor_(params);
    requireRole_(actor, ['Admin Cabang']);
    const targetEmail = params.targetEmail;
    if (!targetEmail) throw { code: 'VALIDATION_ERROR', message: 'targetEmail wajib diisi' };
    if (String(targetEmail).trim().toLowerCase() === String(actor.email).trim().toLowerCase()) {
      throw { code: 'VALIDATION_ERROR', message: 'Tidak bisa menghapus akun sendiri' };
    }
    return withLock_(function () {
      deleteRowByKey_('Users', 'Email', targetEmail);
      return { email: targetEmail };
    });
  },

  // Set/reset password login manual (Admin Cabang saja). Hash dihitung di
  // Next.js (scrypt) - Code.gs cuma menyimpan string hash apa adanya, tidak
  // pernah menerima/menyimpan password plaintext.
  setUserPassword: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const targetEmail = params.targetEmail;
    const passwordHash = params.passwordHash;
    if (!targetEmail || !passwordHash) {
      throw { code: 'VALIDATION_ERROR', message: 'targetEmail dan passwordHash wajib diisi' };
    }
    return withLock_(function () {
      updateRowByKey_('Users', 'Email', targetEmail, { 'Password Hash': passwordHash });
      return { email: targetEmail };
    });
  },

  // Ambil hash password untuk verifikasi login manual. Dipanggil NextAuth
  // Credentials provider SEBELUM ada sesi, jadi sengaja tidak pakai
  // requireActor_ - perlindungan satu-satunya adalah SHARED_SECRET di
  // isAuthorized_ (sama seperti getUserByEmail di doGet untuk login Google).
  getPasswordHash: function (params) {
    const email = String(params.email || '').trim().toLowerCase();
    if (!email) throw { code: 'VALIDATION_ERROR', message: 'email wajib diisi' };
    const table = readTable_('Users');
    const row = table.rows.find(function (r) {
      return String(r['Email']).trim().toLowerCase() === email;
    });
    if (!row) return { found: false };
    return {
      found: true,
      passwordHash: row['Password Hash'] || '',
      nama: row['Nama'],
      email: row['Email'],
      role: row['Role'],
      dropPoint: row['Drop Point'],
      statusAktif: isActive_(row['Status Aktif']),
    };
  },

  // ---- Master Drop Point ----
  listDropPoints: function (params) {
    requireActor_(params); // siapa pun yang login boleh baca (dipakai dropdown)
    return readTable_('Master Drop Point').rows.map(stripRow_);
  },

  createDropPoint: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const payload = params.data || {};
    if (!payload.kodeDp || !payload.namaDp) {
      throw { code: 'VALIDATION_ERROR', message: 'Kode DP dan Nama DP wajib diisi' };
    }
    return withLock_(function () {
      const table = readTable_('Master Drop Point');
      const exists = table.rows.some(function (r) { return String(r['Kode DP']).trim().toLowerCase() === String(payload.kodeDp).trim().toLowerCase(); });
      if (exists) throw { code: 'CONFLICT', message: 'Kode DP sudah ada' };
      appendRow_('Master Drop Point', {
        'Kode DP': payload.kodeDp,
        'Nama DP': payload.namaDp,
        'Wilayah/Cabang': payload.wilayah || '',
        'Status Aktif': 'Aktif',
      });
      return { kodeDp: payload.kodeDp };
    });
  },

  updateDropPoint: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const payload = params.data || {};
    const patch = {};
    if (payload.namaDp !== undefined) patch['Nama DP'] = payload.namaDp;
    if (payload.wilayah !== undefined) patch['Wilayah/Cabang'] = payload.wilayah;
    if (payload.statusAktif !== undefined) patch['Status Aktif'] = payload.statusAktif ? 'Aktif' : 'Nonaktif';
    return withLock_(function () {
      return updateRowByKey_('Master Drop Point', 'Kode DP', params.kodeDp, patch);
    });
  },

  deleteDropPoint: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    return withLock_(function () {
      deleteRowByKey_('Master Drop Point', 'Kode DP', params.kodeDp);
      return { kodeDp: params.kodeDp };
    });
  },

  // ---- Master Feedback ----
  listMasterFeedback: function (params) {
    requireActor_(params);
    return readTable_('Master Feedback').rows.map(stripRow_);
  },

  createMasterFeedback: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const payload = params.data || {};
    if (!payload.namaFeedback) throw { code: 'VALIDATION_ERROR', message: 'Nama Feedback wajib diisi' };
    return withLock_(function () {
      const table = readTable_('Master Feedback');
      const exists = table.rows.some(function (r) { return String(r['Nama Feedback']).trim().toLowerCase() === String(payload.namaFeedback).trim().toLowerCase(); });
      if (exists) throw { code: 'CONFLICT', message: 'Nama Feedback sudah ada' };
      const nextId = table.rows.reduce(function (max, r) { return Math.max(max, Number(r['ID']) || 0); }, 0) + 1;
      appendRow_('Master Feedback', {
        'ID': nextId,
        'Nama Feedback': payload.namaFeedback,
        'Status Aktif': 'Aktif',
      });
      return { id: nextId };
    });
  },

  updateMasterFeedback: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const payload = params.data || {};
    const patch = {};
    if (payload.namaFeedback !== undefined) patch['Nama Feedback'] = payload.namaFeedback;
    if (payload.statusAktif !== undefined) patch['Status Aktif'] = payload.statusAktif ? 'Aktif' : 'Nonaktif';
    return withLock_(function () {
      return updateRowByKey_('Master Feedback', 'ID', params.id, patch);
    });
  },

  deleteMasterFeedback: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    return withLock_(function () {
      deleteRowByKey_('Master Feedback', 'ID', params.id);
      return { id: params.id };
    });
  },

  // ---- Favorite Feedback (selalu di-scope ke email aktor sendiri - Bagian 11 PRD) ----
  listFavoriteFeedback: function (params) {
    const actor = requireActor_(params);
    const needle = actor.email.trim().toLowerCase();
    return readTable_('Favorite Feedback').rows
      .filter(function (r) { return String(r['Email Admin DP']).trim().toLowerCase() === needle; })
      .sort(function (a, b) { return (Number(a['Urutan']) || 0) - (Number(b['Urutan']) || 0); })
      .map(stripRow_);
  },

  addFavoriteFeedback: function (params) {
    const actor = requireActor_(params);
    const payload = params.data || {};
    if (!payload.namaFeedback) throw { code: 'VALIDATION_ERROR', message: 'Nama Feedback wajib diisi' };
    return withLock_(function () {
      const table = readTable_('Favorite Feedback');
      const needle = actor.email.trim().toLowerCase();
      const mine = table.rows.filter(function (r) { return String(r['Email Admin DP']).trim().toLowerCase() === needle; });
      const exists = mine.some(function (r) { return String(r['Nama Feedback']).trim().toLowerCase() === String(payload.namaFeedback).trim().toLowerCase(); });
      if (exists) throw { code: 'CONFLICT', message: 'Feedback sudah ada di favorit' };
      const nextOrder = mine.reduce(function (max, r) { return Math.max(max, Number(r['Urutan']) || 0); }, 0) + 1;
      appendRow_('Favorite Feedback', {
        'Email Admin DP': actor.email,
        'Nama Feedback': payload.namaFeedback,
        'Urutan': nextOrder,
      });
      return { namaFeedback: payload.namaFeedback };
    });
  },

  removeFavoriteFeedback: function (params) {
    const actor = requireActor_(params);
    const namaFeedback = params.namaFeedback;
    return withLock_(function () {
      const table = readTable_('Favorite Feedback');
      const needleEmail = actor.email.trim().toLowerCase();
      const needleFeedback = String(namaFeedback).trim().toLowerCase();
      const target = table.rows.find(function (r) {
        return String(r['Email Admin DP']).trim().toLowerCase() === needleEmail &&
          String(r['Nama Feedback']).trim().toLowerCase() === needleFeedback;
      });
      if (!target) throw { code: 'NOT_FOUND', message: 'Favorit tidak ditemukan' };
      table.sheet.deleteRow(target.__row);
      return { namaFeedback: namaFeedback };
    });
  },

  // ---- LongTail (Admin DP di-scope ke DP miliknya sendiri - Bagian 5 PRD) ----
  listLongTail: function (params) {
    const actor = requireActor_(params);
    const rows = readTable_('LongTail').rows;
    const scoped = actor.role === 'Admin Cabang'
      ? rows
      : rows.filter(function (r) { return String(r['DP Sampai']).trim().toLowerCase() === String(actor.dropPoint).trim().toLowerCase(); });
    return scoped.map(decorateLongTailRow_);
  },

  getLongTail: function (params) {
    const actor = requireActor_(params);
    const rows = readTable_('LongTail').rows;
    const row = rows.find(function (r) { return String(r['No. Waybill']).trim() === String(params.waybill).trim(); });
    if (!row) throw { code: 'NOT_FOUND', message: 'Waybill tidak ditemukan' };
    if (actor.role !== 'Admin Cabang' && String(row['DP Sampai']).trim().toLowerCase() !== String(actor.dropPoint).trim().toLowerCase()) {
      throw { code: 'FORBIDDEN', message: 'Tidak punya akses ke waybill ini' };
    }
    return decorateLongTailRow_(row);
  },

  // Fase 4 (Bagian 9.0 & 9.4 PRD): submit feedback untuk 1 waybill.
  //  - Optimistic locking: client mengirim `baseVersion` = versi Feedback+Log
  //    Feedback saat baris terakhir dimuat. Jika sudah berubah di server ->
  //    CONFLICT (jangan timpa diam-diam), kembalikan baris terkini utk refresh.
  //  - Log Feedback: baca sel sekarang, tambahkan baris 'DD/MM/YY : <feedback>'
  //    di akhir (isi lama TIDAK pernah dihapus), tulis ulang ke sel yang sama.
  //  - Paralel: 1 baris terstruktur ke Activity_Log (Sumber = 'Manual Feedback').
  //  - Freeze Umur Paket bila feedback baru membuat waybill jadi Clear TTD.
  submitFeedback: function (params) {
    const actor = requireActor_(params);
    const waybill = params.waybill;
    const feedback = String(params.feedback == null ? '' : params.feedback).trim();
    if (!waybill) throw { code: 'VALIDATION_ERROR', message: 'waybill wajib diisi' };
    if (!feedback) throw { code: 'VALIDATION_ERROR', message: 'feedback tidak boleh kosong' };

    return withLock_(function () {
      const table = readTable_('LongTail');
      const current = table.rows.find(function (r) { return String(r['No. Waybill']).trim() === String(waybill).trim(); });
      if (!current) throw { code: 'NOT_FOUND', message: 'Waybill tidak ditemukan' };
      if (actor.role !== 'Admin Cabang' && String(current['DP Sampai']).trim().toLowerCase() !== String(actor.dropPoint).trim().toLowerCase()) {
        throw { code: 'FORBIDDEN', message: 'Tidak punya akses ke waybill ini' };
      }

      // Sudah Clear TTD sebelum submit ini -> feedback dibekukan (Bagian 9.0/9.1).
      if (isClearTTDFeedback_(current['Feedback'])) {
        throw { code: 'ALREADY_CLEAR_TTD', message: 'Waybill sudah Clear TTD - feedback dibekukan, tidak bisa diubah.' };
      }

      // Optimistic lock: bandingkan versi server sekarang dgn yg dilihat client.
      const serverVersion = rowVersion_(current);
      if (params.baseVersion !== undefined && params.baseVersion !== null && String(params.baseVersion) !== serverVersion) {
        throw {
          code: 'VERSION_CONFLICT',
          message: 'Baris ini sudah diubah oleh proses/user lain. Muat ulang sebelum menyimpan.',
          data: decorateLongTailRow_(current),
        };
      }

      const parts = nowParts_();
      const oldFeedback = String(current['Feedback'] == null ? '' : current['Feedback']);
      const oldLog = String(current['Log Feedback'] == null ? '' : current['Log Feedback']);
      const newLogLine = parts.tanggal + ' : ' + feedback;
      const newLog = oldLog ? oldLog + '\n' + newLogLine : newLogLine;

      const patch = {
        'Feedback': feedback,
        'Status Terakhir': feedback, // Bagian 9.0: Status Terakhir ikut ter-update
        'Log Feedback': newLog,
      };
      // Freeze Umur Paket tepat saat transisi ke Clear TTD.
      if (isClearTTDFeedback_(feedback)) {
        var umurNow = computeUmur_({ 'Waktu Sampai': current['Waktu Sampai'], 'Feedback': '', 'Umur Paket': '' });
        patch['Umur Paket'] = umurNow === '' ? '' : umurNow;
      }

      const updated = updateRowByKey_('LongTail', 'No. Waybill', waybill, patch);

      appendActivityLog_({
        user: actor.email,
        dp: current['DP Sampai'],
        waybill: waybill,
        attempt: nextAttempt_(waybill),
        dataLama: oldFeedback,
        dataBaru: feedback,
        tanggal: parts.tanggal,
        jam: parts.jam,
        sumber: 'Manual Feedback',
      });

      return decorateLongTailRow_(Object.assign({}, current, patch));
    });
  },

  // ---- Arsip Data (Fase 8, Bagian 8 PRD) ----
  // Pindah paket Clear TTD yang sudah > N hari (default 30) dari LongTail ke
  // LongTail_Archive supaya sheet utama tetap ringan. Manual (MVP); cron/trigger
  // menyusul jika disetujui. Tanggal Clear = Waktu Sampai + Umur beku (Umur
  // dibekukan tepat saat Clear TTD, jadi ini = tanggal paket di-clear).
  //  - dryRun: hanya hitung, tidak memindah (utk preview di UI).
  //  - waybills[]: arsipkan hanya waybill tsb (abaikan ambang umur) -> arsip manual selektif.
  archiveClearTTD: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    var thresholdDays = params.thresholdDays != null ? Number(params.thresholdDays) : 30;
    var dryRun = !!params.dryRun;
    var only = Array.isArray(params.waybills) && params.waybills.length
      ? params.waybills.map(function (w) { return String(w).trim().toLowerCase(); })
      : null;

    return withLock_(function () {
      var lt = readTable_('LongTail');
      var archiveSheet = getSheet_('LongTail_Archive');
      var archiveHeaders = archiveSheet.getDataRange().getValues()[0];
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var eligible = lt.rows.filter(function (r) {
        if (!isClearTTDFeedback_(r['Feedback'])) return false;
        if (only) return only.indexOf(String(r['No. Waybill']).trim().toLowerCase()) !== -1;
        var ws = r['Waktu Sampai'];
        var d = ws instanceof Date ? ws : (ws ? new Date(ws) : null);
        var umur = Number(r['Umur Paket']);
        if (!d || isNaN(d.getTime()) || !isFinite(umur)) return false; // tak bisa tentukan tgl clear -> jangan arsip
        var clearDate = new Date(d.getTime() + umur * MS_PER_DAY_);
        var hariSejakClear = Math.floor((today.getTime() - clearDate.getTime()) / MS_PER_DAY_);
        return hariSejakClear > thresholdDays;
      });

      if (dryRun) return { eligible: eligible.length, thresholdDays: thresholdDays };

      var tglArsip = nowParts_().tanggal;
      eligible.forEach(function (r) {
        var arr = archiveHeaders.map(function (h) {
          return h === 'Tanggal Arsip' ? tglArsip : (r[h] !== undefined ? r[h] : '');
        });
        archiveSheet.appendRow(arr);
      });
      // Hapus dari LongTail dari baris terbawah supaya __row tetap valid.
      eligible.sort(function (a, b) { return b.__row - a.__row; }).forEach(function (r) {
        lt.sheet.deleteRow(r.__row);
      });
      return { archived: eligible.length, thresholdDays: thresholdDays };
    });
  },

  // ---- Reset Data Long Tail (bersihkan data transaksi untuk go-live) ----
  // Kosongkan HANYA sheet transaksi; master data (Users, Master Drop Point,
  // Master/Favorite Feedback, Import Mapping) tidak disentuh. Admin Cabang saja.
  // dryRun=true -> hanya menghitung berapa yang akan dihapus (untuk konfirmasi UI).
  // Tindakan ini PERMANEN dan tidak bisa dibatalkan.
  resetLongTailData: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    var targets = ['LongTail', 'LongTail_Archive', 'Activity_Log', 'Import Batch'];
    if (params.dryRun) {
      var counts = {};
      targets.forEach(function (name) { counts[name] = countSheetData_(name); });
      return { dryRun: true, counts: counts };
    }
    return withLock_(function () {
      var cleared = {};
      targets.forEach(function (name) { cleared[name] = clearSheetData_(name); });
      return { cleared: cleared };
    });
  },

  createLongTail: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    const payload = params.data || {};
    if (!payload.noWaybill) throw { code: 'VALIDATION_ERROR', message: 'No. Waybill wajib diisi' };
    return withLock_(function () {
      const table = readTable_('LongTail');
      const exists = table.rows.some(function (r) { return String(r['No. Waybill']).trim() === String(payload.noWaybill).trim(); });
      if (exists) throw { code: 'CONFLICT', message: 'Waybill sudah ada' };
      appendRow_('LongTail', {
        'No. Waybill': payload.noWaybill,
        'Status Terakhir': payload.statusTerakhir || '',
        'Alasan Paket Bermasalah': payload.alasanBermasalah || '',
        'DP Sampai': payload.dpSampai || '',
        'Waktu Sampai': payload.waktuSampai ? toDateIfIso_(payload.waktuSampai) : '',
        'Umur Paket': '',
        'Sprinter Delivery': payload.sprinterDelivery || '',
        'COD': payload.cod || '',
        'Delivery Attempt': payload.deliveryAttempt || 0,
        'Feedback': '',
        'Log Feedback': '',
      });
      return { noWaybill: payload.noWaybill };
    });
  },

  updateLongTail: function (params) {
    const actor = requireActor_(params);
    const waybill = params.waybill;
    const payload = params.data || {};
    // 'feedback' SENGAJA tidak ada di sini (Fase 4): satu-satunya jalur ubah
    // Feedback adalah submitFeedback, yang meng-append Log Feedback, menulis
    // Activity_Log, dan membekukan Umur saat Clear TTD. updateLongTail hanya
    // untuk koreksi field non-feedback.
    const colMap = {
      statusTerakhir: 'Status Terakhir',
      alasanBermasalah: 'Alasan Paket Bermasalah',
      dpSampai: 'DP Sampai',
      waktuSampai: 'Waktu Sampai',
      sprinterDelivery: 'Sprinter Delivery',
      cod: 'COD',
      deliveryAttempt: 'Delivery Attempt',
    };
    return withLock_(function () {
      const table = readTable_('LongTail');
      const current = table.rows.find(function (r) { return String(r['No. Waybill']).trim() === String(waybill).trim(); });
      if (!current) throw { code: 'NOT_FOUND', message: 'Waybill tidak ditemukan' };
      if (actor.role !== 'Admin Cabang' && String(current['DP Sampai']).trim().toLowerCase() !== String(actor.dropPoint).trim().toLowerCase()) {
        throw { code: 'FORBIDDEN', message: 'Tidak punya akses ke waybill ini' };
      }
      const patch = {};
      Object.keys(colMap).forEach(function (key) {
        if (payload[key] !== undefined) {
          patch[colMap[key]] = key === 'waktuSampai' ? toDateIfIso_(payload[key]) : payload[key];
        }
      });
      return updateRowByKey_('LongTail', 'No. Waybill', waybill, patch);
    });
  },

  // Hapus 1 baris LongTail (Admin Cabang). Di luar PRD inti; dipakai untuk
  // koreksi data salah-import / bersihkan baris test. Dicatat ke Activity_Log.
  deleteLongTail: function (params) {
    const actor = requireActor_(params);
    requireRole_(actor, ['Admin Cabang']);
    const waybill = params.waybill;
    if (!waybill) throw { code: 'VALIDATION_ERROR', message: 'waybill wajib diisi' };
    return withLock_(function () {
      const table = readTable_('LongTail');
      const target = table.rows.find(function (r) { return String(r['No. Waybill']).trim() === String(waybill).trim(); });
      if (!target) throw { code: 'NOT_FOUND', message: 'Waybill tidak ditemukan' };
      const parts = nowParts_();
      appendActivityLog_({
        user: actor.email,
        dp: target['DP Sampai'],
        waybill: waybill,
        attempt: nextAttempt_(waybill),
        dataLama: JSON.stringify({ 'Status Terakhir': target['Status Terakhir'], 'Feedback': target['Feedback'] }),
        dataBaru: 'DELETED',
        tanggal: parts.tanggal,
        jam: parts.jam,
        sumber: 'Hapus Manual', // BUKAN 'Manual Feedback' -> jangan terhitung di Progress Hari Ini
      });
      table.sheet.deleteRow(target.__row);
      return { waybill: waybill };
    });
  },

  // ---- Import Long Tail (Fase 3) ----
  // Dedup lintas batch (Bagian 7.1 PRD) dijalankan server-side di bawah lock:
  //  - waybill baru        -> insert baris baru
  //  - sudah ada, belum TTD -> update field berubah, PERTAHANKAN Feedback & Log Feedback
  //  - sudah Clear TTD     -> tandai 'Perlu Review'='Ya', JANGAN timpa status
  // Setiap perubahan dicatat ke Activity_Log (Sumber = 'Auto-update Import') + 1 baris ke Import Batch.
  importLongTail: function (params) {
    const actor = requireActor_(params);
    requireRole_(actor, ['Admin Cabang']);
    const fileName = params.fileName || '';
    const incoming = Array.isArray(params.rows) ? params.rows : [];

    return withLock_(function () {
      ensureImportInfrastructure_();

      const lt = readTable_('LongTail');
      const sheet = lt.sheet;
      const headers = lt.headers;
      const colIndex = {};
      headers.forEach(function (h, i) { colIndex[h] = i; });

      const index = {};
      lt.rows.forEach(function (r) { index[String(r['No. Waybill']).trim().toLowerCase()] = r; });

      const alSheet = getSheet_('Activity_Log');
      const alValues = alSheet.getDataRange().getValues();
      const alWbIdx = alValues[0].indexOf('Waybill');
      const attemptMap = {};
      for (var i = 1; i < alValues.length; i++) {
        var w = String(alValues[i][alWbIdx]).trim().toLowerCase();
        if (w) attemptMap[w] = (attemptMap[w] || 0) + 1;
      }
      function nextAttempt(k) { attemptMap[k] = (attemptMap[k] || 0) + 1; return attemptMap[k]; }

      const parts = nowParts_();
      const newRows = [];
      const newLogs = [];
      var inserted = 0, updated = 0, needReview = 0, skipped = 0;

      function ltRowArray(obj) {
        return headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
      }

      incoming.forEach(function (row) {
        const wb = String(row.noWaybill == null ? '' : row.noWaybill).trim();
        if (!wb) { skipped++; return; }
        const key = wb.toLowerCase();
        const existing = index[key];

        if (!existing) {
          const obj = {
            'No. Waybill': wb,
            'Status Terakhir': row.statusTerakhir || '',
            'Alasan Paket Bermasalah': row.alasanBermasalah || '',
            'DP Sampai': row.dpSampai || '',
            'Waktu Sampai': row.waktuSampai ? toDateIfIso_(row.waktuSampai) : '',
            'Umur Paket': '',
            'Sprinter Delivery': row.sprinterDelivery || '',
            'COD': row.cod || '',
            'Delivery Attempt': row.deliveryAttempt || 0,
            'Feedback': '',
            'Log Feedback': '',
            'Perlu Review': '',
          };
          newRows.push(ltRowArray(obj));
          index[key] = obj;
          inserted++;
          newLogs.push([actor.email, obj['DP Sampai'], wb, nextAttempt(key), '', 'Import baru: ' + (obj['Status Terakhir'] || ''), parts.tanggal, parts.jam, 'Auto-update Import']);
          return;
        }

        if (isClearTTDFeedback_(existing['Feedback'])) {
          if (existing.__row) sheet.getRange(existing.__row, colIndex['Perlu Review'] + 1).setValue('Ya');
          existing['Perlu Review'] = 'Ya';
          needReview++;
          newLogs.push([actor.email, existing['DP Sampai'], wb, nextAttempt(key), 'Clear TTD', 'Muncul lagi di import -> Perlu Review', parts.tanggal, parts.jam, 'Auto-update Import']);
          return;
        }

        const before = { 'Status Terakhir': existing['Status Terakhir'], 'Waktu Sampai': existing['Waktu Sampai'], 'DP Sampai': existing['DP Sampai'] };
        const patch = {};
        if (row.statusTerakhir) patch['Status Terakhir'] = row.statusTerakhir;
        if (row.alasanBermasalah) patch['Alasan Paket Bermasalah'] = row.alasanBermasalah;
        if (row.dpSampai) patch['DP Sampai'] = row.dpSampai;
        if (row.waktuSampai) patch['Waktu Sampai'] = toDateIfIso_(row.waktuSampai);
        if (row.sprinterDelivery) patch['Sprinter Delivery'] = row.sprinterDelivery;
        if (row.cod) patch['COD'] = row.cod;
        if (row.deliveryAttempt !== undefined && row.deliveryAttempt !== '') patch['Delivery Attempt'] = row.deliveryAttempt;

        const merged = Object.assign({}, existing, patch);
        if (existing.__row) sheet.getRange(existing.__row, 1, 1, headers.length).setValues([ltRowArray(merged)]);
        Object.keys(patch).forEach(function (k) { existing[k] = patch[k]; });
        updated++;
        newLogs.push([actor.email, merged['DP Sampai'], wb, nextAttempt(key), JSON.stringify(before), JSON.stringify(patch), parts.tanggal, parts.jam, 'Auto-update Import']);
      });

      if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
      if (newLogs.length) alSheet.getRange(alSheet.getLastRow() + 1, 1, newLogs.length, newLogs[0].length).setValues(newLogs);

      const batchId = 'B' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
      appendRow_('Import Batch', {
        'Batch ID': batchId,
        'Tanggal': parts.tanggal,
        'Jam': parts.jam,
        'Admin Cabang': actor.email,
        'Nama File': fileName,
        'Total Baris': incoming.length,
        'Berhasil': inserted + updated + needReview,
        'Gagal': skipped,
        'Status': skipped > 0 ? 'Sebagian' : 'Sukses',
        'Keterangan': 'Baru ' + inserted + ', Update ' + updated + ', Perlu Review ' + needReview + ', Skip ' + skipped,
      });

      return { batchId: batchId, total: incoming.length, inserted: inserted, updated: updated, needReview: needReview, skipped: skipped };
    });
  },

  listImportBatches: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    ensureImportInfrastructure_();
    // Tanggal/Jam bisa ter-coerce jadi Date oleh Sheets -> format konsisten.
    return readTable_('Import Batch').rows.map(function (r) {
      var clean = stripRow_(r);
      clean['Tanggal'] = formatTanggal_(clean['Tanggal']);
      clean['Jam'] = formatJam_(clean['Jam']);
      return clean;
    }).reverse(); // terbaru di atas (append kronologis)
  },

  // ---- Import Mapping templates (Fase 3 / Bagian 7.2) ----
  listMappingTemplates: function (params) {
    requireActor_(params);
    ensureImportInfrastructure_();
    return readTable_('Import Mapping').rows.map(function (r) {
      var mapping = {};
      try { mapping = JSON.parse(r['Mapping'] || '{}'); } catch (e) { mapping = {}; }
      return { namaTemplate: r['Nama Template'], mapping: mapping, dibuatOleh: r['Dibuat Oleh'], tanggal: r['Tanggal'] };
    });
  },

  saveMappingTemplate: function (params) {
    const actor = requireActor_(params);
    requireRole_(actor, ['Admin Cabang']);
    const payload = params.data || {};
    if (!payload.namaTemplate || !payload.mapping) throw { code: 'VALIDATION_ERROR', message: 'namaTemplate & mapping wajib diisi' };
    return withLock_(function () {
      ensureImportInfrastructure_();
      const parts = nowParts_();
      const table = readTable_('Import Mapping');
      const exists = table.rows.some(function (r) { return String(r['Nama Template']).trim().toLowerCase() === String(payload.namaTemplate).trim().toLowerCase(); });
      if (exists) {
        return updateRowByKey_('Import Mapping', 'Nama Template', payload.namaTemplate, {
          'Mapping': JSON.stringify(payload.mapping),
          'Dibuat Oleh': actor.email,
          'Tanggal': parts.tanggal,
        });
      }
      appendRow_('Import Mapping', {
        'Nama Template': payload.namaTemplate,
        'Mapping': JSON.stringify(payload.mapping),
        'Dibuat Oleh': actor.email,
        'Tanggal': parts.tanggal,
      });
      return { namaTemplate: payload.namaTemplate };
    });
  },

  deleteMappingTemplate: function (params) {
    requireRole_(requireActor_(params), ['Admin Cabang']);
    return withLock_(function () {
      ensureImportInfrastructure_();
      deleteRowByKey_('Import Mapping', 'Nama Template', params.namaTemplate);
      return { namaTemplate: params.namaTemplate };
    });
  },

  // ---- Riwayat Feedback (Bagian 13 PRD) ----
  // Sumber: Activity_Log (baris 'Manual Feedback'), di-JOIN ke LongTail untuk
  // kolom "Status Terkini". Di-scope per role: Admin DP hanya DP miliknya.
  // Rentang tanggal dikirim client sbg ISO 'YYYY-MM-DD' (tidak ambigu).
  listRiwayatFeedback: function (params) {
    const actor = requireActor_(params);
    const isCabang = actor.role === 'Admin Cabang';

    var fromTs = null, toTs = null;
    if (params.from) {
      var f = parseIsoDate_(params.from);
      if (f) { f.setHours(0, 0, 0, 0); fromTs = f.getTime(); }
    }
    if (params.to) {
      var t = parseIsoDate_(params.to);
      if (t) { t.setHours(23, 59, 59, 999); toTs = t.getTime(); }
    }

    // Index LongTail utk Status Terkini (1 kali baca, bukan per baris log).
    var ltIndex = {};
    readTable_('LongTail').rows.forEach(function (r) {
      ltIndex[String(r['No. Waybill']).trim().toLowerCase()] = r;
    });

    var mineDp = String(actor.dropPoint).trim().toLowerCase();
    var out = [];
    readTable_('Activity_Log').rows.forEach(function (a) {
      if (String(a['Sumber Perubahan']) !== 'Manual Feedback') return;

      var dp = String(a['DP'] == null ? '' : a['DP']).trim();
      if (!isCabang && dp.toLowerCase() !== mineDp) return;

      var d = parseTanggal_(a['Tanggal']);
      var ts = d ? d.getTime() : null;
      if (fromTs != null && (ts == null || ts < fromTs)) return;
      if (toTs != null && (ts == null || ts > toTs)) return;

      var wb = String(a['Waybill'] == null ? '' : a['Waybill']).trim();
      var lt = ltIndex[wb.toLowerCase()];

      out.push({
        waybill: wb,
        tanggal: formatTanggal_(a['Tanggal']),
        jam: formatJam_(a['Jam']),
        attempt: a['Attempt Ke-'],
        feedbackSaatItu: String(a['Data Baru'] == null ? '' : a['Data Baru']),
        adminDp: String(a['User'] == null ? '' : a['User']),
        dp: dp,
        // Baris bisa saja sudah dihapus dari LongTail (koreksi salah import).
        statusTerkini: lt ? (isClearTTDFeedback_(lt['Feedback']) ? 'Clear TTD' : 'Belum Clear TTD') : 'Tidak ada di LongTail',
        // Nilai epoch utk sorting stabil di client.
        ts: ts,
      });
    });

    // Terbaru di atas.
    out.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
    return out;
  },

  // ---- Dashboard (Fase 5, Bagian 8 & 13 PRD) ----
  // Semua angka dihitung server-side dari LongTail + Activity_Log (BUKAN parsing
  // teks Log Feedback). Di-scope per role: Admin DP hanya DP miliknya. Read-only,
  // jadi tidak pakai lock.
  // Waktu data terakhir berubah (import atau feedback) = entri terakhir di
  // Activity_Log. Admin DP di-scope ke DP-nya; Admin Cabang global.
  getLastUpdate: function (params) {
    var actor = requireActor_(params);
    var isCabang = actor.role === 'Admin Cabang';
    var mine = String(actor.dropPoint).trim().toLowerCase();
    var rows = readTable_('Activity_Log').rows;
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (!isCabang && String(r['DP'] || '').trim().toLowerCase() !== mine) continue;
      var t = r['Tanggal'];
      var tanggal = (t instanceof Date)
        ? Utilities.formatDate(t, Session.getScriptTimeZone(), 'dd/MM/yy')
        : String(t == null ? '' : t).trim();
      return { hasUpdate: true, tanggal: tanggal, jam: formatJam_(r['Jam']), sumber: String(r['Sumber Perubahan'] || '') };
    }
    return { hasUpdate: false };
  },

  getDashboard: function (params) {
    const actor = requireActor_(params);
    const isCabang = actor.role === 'Admin Cabang';

    var rows = readTable_('LongTail').rows;
    if (!isCabang) {
      var mine = String(actor.dropPoint).trim().toLowerCase();
      rows = rows.filter(function (r) { return String(r['DP Sampai']).trim().toLowerCase() === mine; });
    } else if (params.dp && String(params.dp) !== 'ALL') {
      // Admin Cabang memilih 1 DP di filter CAKUPAN -> filter sama spt Admin DP.
      var pick = String(params.dp).trim().toLowerCase();
      rows = rows.filter(function (r) { return String(r['DP Sampai']).trim().toLowerCase() === pick; });
    }

    // --- Ringkasan + distribusi + aging (snapshot dari LongTail) ---
    var total = rows.length;
    var sudah = 0, clearTTD = 0, lebih3 = 0, paketTertua = 0, paketTertuaWb = '';
    var distribusi = { 'Clear TTD': 0, 'On Delivery': 0, 'Reschedule': 0, 'Penerima Tidak Di Tempat': 0, 'Alamat Tidak Ditemukan': 0, 'Lainnya': 0, 'Belum Feedback': 0 };
    var agingBuckets = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
    var perDp = {};   // kodeDp -> {total, sudah, clearTTD, lebih3}
    var perSprinter = {}; // sprinter -> {total, sudah}

    rows.forEach(function (r) {
      var fb = String(r['Feedback'] == null ? '' : r['Feedback']).trim();
      var isTTD = isClearTTDFeedback_(fb);
      var umur = computeUmur_(r);
      var umurNum = (typeof umur === 'number') ? umur : Number(umur);
      if (!isFinite(umurNum)) umurNum = null;

      if (fb !== '') sudah++;
      if (isTTD) clearTTD++;
      distribusi[categorizeFeedback_(fb)]++;

      // Aging hanya untuk yang BELUM Clear TTD (fokus monitoring, keputusan user).
      // Bucket umur 1..6, dan 7+ untuk >=7. Umur 0 (baru sampai hari ini) belum
      // masuk bucket "Hari ke-1" -- konsisten dgn warna aging (0 = netral).
      if (!isTTD && umurNum != null) {
        if (umurNum >= 3) lebih3++;
        if (umurNum > paketTertua) { paketTertua = umurNum; paketTertuaWb = r['No. Waybill']; }
        if (umurNum >= 1) {
          var key = umurNum >= 7 ? '7+' : String(umurNum);
          agingBuckets[key]++;
        }
      }

      var dp = String(r['DP Sampai'] || '').trim() || '(kosong)';
      if (!perDp[dp]) perDp[dp] = { dp: dp, total: 0, sudah: 0, clearTTD: 0, lebih3: 0 };
      perDp[dp].total++;
      if (fb !== '') perDp[dp].sudah++;
      if (isTTD) perDp[dp].clearTTD++;
      if (!isTTD && umurNum != null && umurNum >= 3) perDp[dp].lebih3++;

      var sp = String(r['Sprinter Delivery'] || '').trim() || '(kosong)';
      if (!perSprinter[sp]) perSprinter[sp] = { sprinter: sp, total: 0, sudah: 0 };
      perSprinter[sp].total++;
      if (fb !== '') perSprinter[sp].sudah++;
    });

    // --- Metrik dari Activity_Log: Progress Hari Ini + Last Update per DP ---
    // currentWb = waybill yang MASIH ADA di LongTail (scoped) -> Progress Hari
    // Ini hanya menghitung feedback pada paket yang masih hidup (abaikan jejak
    // feedback pada baris yang sudah dihapus).
    var currentWb = {};
    rows.forEach(function (r) { currentWb[String(r['No. Waybill']).trim().toLowerCase()] = true; });

    var al = readTable_('Activity_Log').rows;
    var today = nowParts_().tanggal; // dd/MM/yy
    var todayWb = {};
    var lastUpdateByDp = {};
    al.forEach(function (a) {
      if (String(a['Sumber Perubahan']) !== 'Manual Feedback') return;
      var dp = String(a['DP'] || '').trim();
      if (!isCabang && dp.toLowerCase() !== String(actor.dropPoint).trim().toLowerCase()) return;
      var wbKey = String(a['Waybill']).trim().toLowerCase();
      if (String(a['Tanggal']) === today && currentWb[wbKey]) todayWb[wbKey] = true;
      // Last update: baris Activity_Log terurut kronologis (append), ambil yang terakhir per DP.
      lastUpdateByDp[dp] = String(a['Tanggal']) + ' ' + formatJam_(a['Jam']);
    });
    var progressHariIni = Object.keys(todayWb).length;

    var monitoringDp = Object.keys(perDp).map(function (dp) {
      var d = perDp[dp];
      return {
        dp: d.dp,
        total: d.total,
        sudah: d.sudah,
        belum: d.total - d.sudah,
        clearTTD: d.clearTTD,
        lebih3: d.lebih3,
        progressPct: d.total ? Math.round((d.sudah / d.total) * 100) : 0,
        lastUpdate: lastUpdateByDp[dp] || '',
      };
    });

    var progressPerSprinter = Object.keys(perSprinter).map(function (sp) {
      var s = perSprinter[sp];
      return { sprinter: s.sprinter, total: s.total, sudah: s.sudah, progressPct: s.total ? Math.round((s.sudah / s.total) * 100) : 0 };
    });

    return {
      role: actor.role,
      dropPoint: actor.dropPoint || '',
      summary: {
        total: total,
        sudahFeedback: sudah,
        belumFeedback: total - sudah,
        clearTTD: clearTTD,
        belumClearTTD: total - clearTTD,
        progressFeedbackPct: total ? Math.round((sudah / total) * 100) : 0,
        paketTertua: paketTertua,
        paketTertuaWaybill: paketTertuaWb,
        paketLebih3Hari: lebih3,
        progressHariIni: progressHariIni,
      },
      distribusiFeedback: Object.keys(distribusi).map(function (k) { return { kategori: k, jumlah: distribusi[k] }; }),
      aging: Object.keys(agingBuckets).map(function (k) { return { hari: k, jumlah: agingBuckets[k] }; }),
      monitoringDp: monitoringDp,
      progressPerSprinter: progressPerSprinter,
    };
  },
};

// ----------------------------------------------------------------------------
// Shared low-level helpers (Fase 1)
// ----------------------------------------------------------------------------

function isAuthorized_(params) {
  const expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  return !!expected && params.secret === expected;
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
