'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, UploadCloud, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/layout/section-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { parseFile } from '@/lib/import/parse';
import { autoDetectMapping, isMappingComplete } from '@/lib/import/mapping';
import { applyMapping, mergeAndDedup } from '@/lib/import/dedup';
import type { HeaderMapping, MappedRow, ParsedFile } from '@/lib/import/types';
import type { ImportResult } from '@/lib/data/import';
import { ImportHistory } from './import-history';
import { ImportStepper, type WizardStep } from './import-stepper';
import { ImportSummarySidebar, HISTORY_ANCHOR_ID } from './import-summary-sidebar';
import { ImportFloatingProgress } from './import-floating-progress';

/** Di bawah ambang ini, import memicu banyak Auto-Close -> minta konfirmasi (Bagian 7.4). */
const SMALL_FILE_THRESHOLD = 100;

// Pemetaan kolom SEPENUHNYA otomatis (autoDetectMapping) — sudah terbukti
// stabil & akurat saat testing, jadi TIDAK ADA langkah/UI mapping manual.
// 'needs-mapping': kolom wajib (No. Waybill) gagal terdeteksi otomatis pada
// file tsb -> file itu dilewati dari import (ditandai di Step Upload),
// bukan kegagalan permanen di level batch.
// 'import-error' SENGAJA tidak ada: kegagalan submit adalah kegagalan BATCH
// gabungan (lihat handleImportAll), bukan per-file — entry kembali ke 'ready'
// supaya tombol Import yang sama bisa dipakai retry.
type EntryStatus = 'parsing' | 'error' | 'needs-mapping' | 'ready' | 'importing' | 'imported';

type FileEntry = {
  id: string;
  fileName: string;
  fileSize: number;
  status: EntryStatus;
  headers?: string[];
  mapping?: HeaderMapping;
  mappedRows?: MappedRow[];
  rawRowCount?: number;
  error?: string;
  raw?: ParsedFile;
};

function computeMapped(parsed: ParsedFile, mapping: HeaderMapping) {
  return mergeAndDedup([applyMapping(parsed, mapping)]).rows;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** File sudah selesai dibaca (bukan sedang parsing/gagal baca). */
function isParsedOk(e: FileEntry) {
  return e.status !== 'parsing' && e.status !== 'error';
}

/** File siap ikut digabung & diimport (pemetaan otomatis lengkap). */
function isUsable(e: FileEntry) {
  return e.status === 'ready' || e.status === 'importing' || e.status === 'imported';
}

/** Step terjauh yang valid dicapai berdasarkan kondisi entries SAAT INI (dihitung ulang tiap render, bukan ratchet satu-arah, supaya menghapus file bisa menurunkan step lagi). */
function computeMaxReached(entries: FileEntry[]): WizardStep {
  return entries.some(isUsable) ? 3 : 1;
}

export function ImportClient() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [rawStep, setStep] = useState<WizardStep>(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number } | null>(null);
  // Konfirmasi batch KECIL (<100 baris GABUNGAN, bukan per-file lagi).
  const [smallConfirm, setSmallConfirm] = useState<{ count: number; resolve: (ok: boolean) => void } | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchResult, setBatchResult] = useState<{ fileNames: string[]; result: ImportResult } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const maxReached = useMemo(() => computeMaxReached(entries), [entries]);
  // Kalau kondisi file berubah (mis. dihapus) sampai step yang sedang aktif
  // jadi tak lagi valid, turunkan step efektif yang dipakai render (bukan
  // lewat efek) supaya user tak "terjebak" di step yang datanya sudah tak
  // konsisten.
  const step = useMemo(() => (rawStep > maxReached ? maxReached : rawStep), [rawStep, maxReached]);

  const askProceedSmall = useCallback(
    (count: number) => new Promise<boolean>((resolve) => setSmallConfirm({ count, resolve })),
    [],
  );

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const ids = files.map(() => crypto.randomUUID());
    setBatchResult(null);
    setBatchError(null);

    setEntries((prev) => [
      ...prev,
      ...files.map((f, i) => ({ id: ids[i], fileName: f.name, fileSize: f.size, status: 'parsing' as const })),
    ]);

    // Dibaca BERURUTAN (bukan Promise.all) supaya widget progres mengambang
    // bisa menampilkan hitungan nyata "N dari M file" — bukan angka pura-pura.
    setParseProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await parseFile(file);
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === ids[i]);
        if (idx === -1) return prev;
        const next = [...prev];
        if (!result.ok) {
          next[idx] = { ...next[idx], status: 'error', error: result.error };
          return next;
        }
        const mapping = autoDetectMapping(result.file.headers);
        const mappedRows = computeMapped(result.file, mapping);
        next[idx] = {
          ...next[idx],
          raw: result.file,
          headers: result.file.headers,
          mapping,
          mappedRows,
          rawRowCount: result.file.rows.length,
          status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping',
        };
        return next;
      });
      setParseProgress({ done: i + 1, total: files.length });
    }
    setParseProgress(null);
  }, []);

  /**
   * SEMUA file siap digabung + dedup dulu (mergeAndDedup), baru dikirim sebagai
   * SATU panggilan /api/import. WAJIB begini (bukan satu panggilan per file):
   * Auto-Close (v1.3) mengarsipkan waybill yang "hilang dari tarikan" per
   * import. Kalau tiap file dikirim terpisah, backend hanya melihat isi file
   * YANG SEDANG diproses sebagai tarikan hari itu — waybill dari file
   * sebelumnya (yang tidak ikut di file berikutnya, mis. beda DP) akan salah
   * dianggap hilang dan diarsipkan. Menggabungkan dulu memastikan Auto-Close
   * melihat seluruh tarikan (semua file) sekaligus.
   */
  async function handleImportAll() {
    const ready = entries.filter((e) => e.status === 'ready' && e.mappedRows);
    if (ready.length === 0) return;

    const combined = mergeAndDedup(ready.map((e) => e.mappedRows!));
    if (combined.rows.length === 0) return;

    if (combined.rows.length < SMALL_FILE_THRESHOLD) {
      const ok = await askProceedSmall(combined.rows.length);
      if (!ok) {
        toast.info('Import dibatalkan');
        return;
      }
    }

    const readyIds = new Set(ready.map((e) => e.id));
    setEntries((prev) => prev.map((e) => (readyIds.has(e.id) ? { ...e, status: 'importing' } : e)));
    setBatchImporting(true);
    setBatchError(null);
    const controller = new AbortController();
    importAbortRef.current = controller;
    try {
      const fileNames = ready.map((e) => e.fileName);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fileNames.join(', '), rows: combined.rows }),
        signal: controller.signal,
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.message || body.error);
      const r: ImportResult = body.data;
      setBatchResult({ fileNames, result: r });
      setEntries((prev) => prev.map((e) => (readyIds.has(e.id) ? { ...e, status: 'imported' } : e)));
      const closeInfo = r.closed ? `, ${r.closed} di-close` : '';
      toast.success(
        `${fileNames.length} file (${combined.rows.length} waybill unik): ${r.inserted} baru, ${r.updated} update, ${r.needReview} perlu review, ${r.skipped} dilewati${closeInfo}`,
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      const message = aborted ? 'Import dibatalkan oleh user' : err instanceof Error ? err.message : 'Gagal import';
      setBatchError(aborted ? null : message);
      // Kembali ke 'ready' (bukan status error permanen) supaya tombol Import
      // yang sama bisa dipakai untuk retry seluruh batch.
      setEntries((prev) => prev.map((e) => (readyIds.has(e.id) ? { ...e, status: 'ready' } : e)));
      if (aborted) toast.info('Import dibatalkan');
      else toast.error(`Gagal import: ${message}`);
    } finally {
      setBatchImporting(false);
      importAbortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    setEntries([]);
    setBatchResult(null);
    setBatchError(null);
    setStep(1);
  }

  function startOver() {
    clearAll();
  }

  const parsedOkEntries = useMemo(() => entries.filter(isParsedOk), [entries]);
  // Selama fase submit, entry 'ready' sudah berubah jadi 'importing' —
  // hitung terpisah supaya widget progres tak menampilkan "0 file".
  const importingCount = entries.filter((e) => e.status === 'importing').length;
  const combined = useMemo(
    () => mergeAndDedup(entries.filter(isUsable).map((e) => e.mappedRows!)),
    [entries],
  );
  const totalBaris = parsedOkEntries.reduce((sum, e) => sum + (e.rawRowCount ?? 0), 0);
  const errorCount = entries.filter((e) => e.status === 'error').length;
  const needsMappingCount = entries.filter((e) => e.status === 'needs-mapping').length;

  const isCancellableImport = batchImporting;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <SectionCard title={<ImportStepper current={step} maxReached={maxReached} onJump={setStep} />}>
          {step === 1 && (
            <StepUpload
              entries={entries}
              dragOver={dragOver}
              setDragOver={setDragOver}
              inputRef={inputRef}
              onFiles={handleFiles}
              onRemove={removeEntry}
              onClearAll={clearAll}
              totalBaris={totalBaris}
              totalWaybillUnik={combined.rows.length}
              duplicate={combined.duplicateCount}
              errorCount={errorCount}
              needsMappingCount={needsMappingCount}
            />
          )}

          {step === 2 && (
            <StepPreview
              rows={combined.rows}
              totalBaris={totalBaris}
              totalWaybillUnik={combined.rows.length}
              duplicate={combined.duplicateCount}
              fileCount={parsedOkEntries.length}
            />
          )}

          {step === 3 && (
            <StepImport
              fileNames={entries.filter(isUsable).map((e) => e.fileName)}
              totalWaybillUnik={combined.rows.length}
              batchImporting={batchImporting}
              batchResult={batchResult}
              batchError={batchError}
              onImport={handleImportAll}
              onStartOver={startOver}
            />
          )}

          <div className="mt-5 flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(step > 1 ? ((step - 1) as WizardStep) : step)} disabled={step === 1}>
              Kembali
            </Button>
            {step < 3 && (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1 && !entries.some(isUsable)) {
                    toast.error('Upload minimal satu file dengan kolom No. Waybill yang berhasil terdeteksi otomatis');
                    return;
                  }
                  setStep(step < 3 ? ((step + 1) as WizardStep) : step);
                }}
              >
                {step === 1 ? 'Lanjut ke Preview Data' : 'Lanjut ke Import Data'}
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard id={HISTORY_ANCHOR_ID} title="Riwayat Import Lengkap">
          <ImportHistory />
        </SectionCard>
      </div>

      <ImportSummarySidebar
        stats={{
          fileCount: entries.length,
          totalBaris,
          totalWaybillUnik: combined.rows.length,
          duplicate: combined.duplicateCount,
          errorCount,
        }}
      />

      {parseProgress && (
        <ImportFloatingProgress
          title="Membaca File…"
          subtitle={`Memproses file ${parseProgress.done} dari ${parseProgress.total}`}
          percent={(parseProgress.done / parseProgress.total) * 100}
        />
      )}
      {isCancellableImport && (
        <ImportFloatingProgress
          title="Importing…"
          subtitle={`Mengimport ${importingCount} file ke LongTail`}
          onCancel={() => importAbortRef.current?.abort()}
        />
      )}

      <Dialog
        open={!!smallConfirm}
        onOpenChange={(o) => {
          if (!o && smallConfirm) {
            smallConfirm.resolve(false);
            setSmallConfirm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch kecil — konfirmasi import</DialogTitle>
            <DialogDescription>
              Gabungan file yang akan diimport hanya berisi{' '}
              <span className="font-medium">{smallConfirm?.count ?? 0}</span> waybill unik (&lt; {SMALL_FILE_THRESHOLD}).
              Paket DP dalam batch ini yang <span className="font-medium">tidak</span> tercantum akan otomatis di-
              <span className="font-medium">Close</span> (Clear TTD / CLOSE ALUR) dan diarsipkan. Pastikan seluruh file
              tarikan hari ini sudah diunggah bersamaan sebelum melanjutkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                smallConfirm?.resolve(false);
                setSmallConfirm(null);
              }}
            >
              Batal
            </Button>
            <Button
              onClick={() => {
                smallConfirm?.resolve(true);
                setSmallConfirm(null);
              }}
            >
              Lanjut Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// STEP 1 — Upload File
// ============================================================================

function StepUpload({
  entries,
  dragOver,
  setDragOver,
  inputRef,
  onFiles,
  onRemove,
  onClearAll,
  totalBaris,
  totalWaybillUnik,
  duplicate,
  errorCount,
  needsMappingCount,
}: {
  entries: FileEntry[];
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  totalBaris: number;
  totalWaybillUnik: number;
  duplicate: number;
  errorCount: number;
  needsMappingCount: number;
}) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          dragOver ? 'border-primary bg-accent' : 'border-muted-foreground/25',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="text-muted-foreground mb-1 size-9" aria-hidden />
        <p className="text-sm font-medium">Drag & drop file Excel (.xlsx / .xls) ke sini</p>
        <p className="text-muted-foreground text-xs">atau</p>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          Pilih File
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Bisa upload beberapa file sekaligus (5-6 file H-20) · XLSX, XLS, CSV · Kolom dipetakan otomatis
        </p>
      </div>

      {entries.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">File yang dipilih ({entries.length})</p>
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll} className="text-destructive">
              <Trash2 className="size-3.5" aria-hidden /> Bersihkan Semua
            </Button>
          </div>

          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border p-2.5',
                  e.status === 'error' && 'border-destructive/40 bg-destructive/5',
                  e.status === 'needs-mapping' && 'border-accent-amber/40 bg-accent-amber/5',
                  e.status !== 'error' && e.status !== 'needs-mapping' && 'border-border',
                )}
              >
                {e.status === 'error' ? (
                  <XCircle className="text-destructive size-5 shrink-0" aria-hidden />
                ) : e.status === 'needs-mapping' ? (
                  <AlertTriangle className="text-accent-amber size-5 shrink-0" aria-hidden />
                ) : (
                  <FileSpreadsheet className="text-accent-green size-5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatSize(e.fileSize)}
                    {e.status === 'parsing' && ' · membaca…'}
                    {e.status === 'error' && ` · ${e.error}`}
                    {e.status === 'needs-mapping' &&
                      ' · Kolom No. Waybill tidak terdeteksi — file ini dilewati saat import'}
                    {isParsedOk(e) && e.status !== 'needs-mapping' && e.rawRowCount != null &&
                      ` · ${e.rawRowCount.toLocaleString('id-ID')} baris terpetakan otomatis`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  aria-label={`Hapus ${e.fileName}`}
                  className="hover:bg-muted rounded-md p-1.5"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3 @lg:grid-cols-5">
            <StatCard label="Total File" value={entries.length} icon={FileSpreadsheet} accent="blue" />
            <StatCard label="Total Baris" value={totalBaris.toLocaleString('id-ID')} icon={FileSpreadsheet} accent="violet" />
            <StatCard label="Total Waybill Unik" value={totalWaybillUnik.toLocaleString('id-ID')} icon={CheckCircle2} accent="green" />
            <StatCard label="Duplicate" value={duplicate.toLocaleString('id-ID')} icon={AlertTriangle} accent="amber" />
            <StatCard label="Error" value={errorCount} icon={XCircle} accent="red" />
          </div>

          {needsMappingCount > 0 && (
            <div className="border-accent-amber/30 bg-accent-amber/5 flex items-start gap-2 rounded-lg border p-3">
              <AlertTriangle className="text-accent-amber mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-xs">
                <span className="font-semibold">{needsMappingCount} file</span> tidak memiliki kolom No. Waybill yang
                bisa terdeteksi otomatis dan akan dilewati. Periksa nama header pada file tersebut lalu upload ulang.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// STEP 2 — Preview Data
// ============================================================================

function StepPreview({
  rows,
  totalBaris,
  totalWaybillUnik,
  duplicate,
  fileCount,
}: {
  rows: MappedRow[];
  totalBaris: number;
  totalWaybillUnik: number;
  duplicate: number;
  fileCount: number;
}) {
  const preview = rows.slice(0, 50);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Cek ringkasan data hasil merge dari <span className="font-medium">{fileCount} file</span> sebelum lanjut
        import. {duplicate > 0 && `${duplicate} baris duplikat sudah digabung otomatis (data terbaru dipakai).`}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total Baris (mentah)" value={totalBaris.toLocaleString('id-ID')} icon={FileSpreadsheet} accent="blue" />
        <StatCard label="Waybill Unik Siap Import" value={totalWaybillUnik.toLocaleString('id-ID')} icon={CheckCircle2} accent="green" />
        <StatCard label="Duplicate Ter-merge" value={duplicate.toLocaleString('id-ID')} icon={AlertTriangle} accent="amber" />
      </div>

      <div className="border-border max-h-96 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Waybill</TableHead>
              <TableHead>Status Terakhir</TableHead>
              <TableHead>DP Sampai</TableHead>
              <TableHead>Waktu Sampai</TableHead>
              <TableHead>Sprinter</TableHead>
              <TableHead>COD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((r) => (
              <TableRow key={r.noWaybill}>
                <TableCell className="font-mono text-xs">{r.noWaybill}</TableCell>
                <TableCell className="text-xs">{String(r.statusTerakhir ?? '—')}</TableCell>
                <TableCell className="text-xs">{String(r.dpSampai ?? '—')}</TableCell>
                <TableCell className="text-xs">{String(r.waktuSampai ?? '—')}</TableCell>
                <TableCell className="text-xs">{String(r.sprinterDelivery ?? '—')}</TableCell>
                <TableCell className="text-xs">{String(r.cod ?? '—')}</TableCell>
              </TableRow>
            ))}
            {preview.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-xs">
                  Tidak ada baris untuk ditampilkan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {rows.length > preview.length && (
        <p className="text-muted-foreground text-xs">Menampilkan {preview.length} dari {rows.length} baris.</p>
      )}
    </div>
  );
}

// ============================================================================
// STEP 3 — Import Data
// ============================================================================

function StepImport({
  fileNames,
  totalWaybillUnik,
  batchImporting,
  batchResult,
  batchError,
  onImport,
  onStartOver,
}: {
  fileNames: string[];
  totalWaybillUnik: number;
  batchImporting: boolean;
  batchResult: { fileNames: string[]; result: ImportResult } | null;
  batchError: string | null;
  onImport: () => void;
  onStartOver: () => void;
}) {
  if (batchResult) {
    const r = batchResult.result;
    return (
      <div className="space-y-4">
        <div className="border-accent-green/30 bg-accent-green/5 flex items-start gap-2 rounded-lg border p-4">
          <CheckCircle2 className="text-accent-green mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Import selesai</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {batchResult.fileNames.length} file: {batchResult.fileNames.join(', ')}
            </p>
            <p className="mt-2 text-sm">
              {r.inserted} baru • {r.updated} update • {r.needReview} perlu review • {r.skipped} dilewati
              {r.closed ? (
                <>
                  {' '}
                  • {r.closed} di-close ({r.closedClearTTD ?? 0} Clear TTD, {r.closedAlur ?? 0} Close Alur)
                </>
              ) : null}
            </p>
          </div>
        </div>
        <Button type="button" onClick={onStartOver}>
          Import File Lain
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-border rounded-lg border p-4">
        <p className="text-sm font-semibold">Siap untuk diimport</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {fileNames.length} file · {totalWaybillUnik.toLocaleString('id-ID')} waybill unik
        </p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc text-xs">
          {fileNames.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      <p className="text-muted-foreground bg-muted/50 rounded-md p-2.5 text-xs leading-relaxed">
        Data akan di-<em>merge</em> dengan data yang sudah ada di LongTail. Paket DP dalam tarikan ini yang tidak
        muncul di file akan otomatis di-Close & diarsipkan (Bagian 7.4).
      </p>

      {batchError && (
        <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
          <p className="text-destructive text-sm font-medium">Gagal import batch</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{batchError}</p>
        </div>
      )}

      <Button type="button" size="lg" onClick={onImport} disabled={fileNames.length === 0 || batchImporting}>
        {batchImporting ? 'Mengimport…' : 'Mulai Import'}
      </Button>
    </div>
  );
}
