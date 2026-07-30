'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  MinusCircle,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePager } from '@/components/ui/table-pager';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { parseFile } from '@/lib/import/parse';
import { autoDetectMapping, isMappingComplete } from '@/lib/import/mapping';
import { applyMapping, mergeAndDedup } from '@/lib/import/dedup';
import { CANONICAL_FIELDS, CANONICAL_FIELD_LABELS, type HeaderMapping, type MappedRow, type ParsedFile } from '@/lib/import/types';
import type { ImportResult, MappingTemplate } from '@/lib/data/import';
import { ImportHistory } from './import-history';
import { ImportStepper, type WizardStep } from './import-stepper';
import { ImportSummarySidebar, HISTORY_ANCHOR_ID } from './import-summary-sidebar';
import { ImportFloatingProgress } from './import-floating-progress';

const IGNORE = '__ignore__';
// WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
// trigger (SelectValue) menampilkan label yang benar (mis. "No. Waybill"),
// bukan value mentah (mis. "noWaybill") — merender <SelectItem> saja tak cukup.
const mappingItems: Record<string, string> = {
  [IGNORE]: 'Abaikan kolom ini',
  ...Object.fromEntries(CANONICAL_FIELDS.map((f) => [f, CANONICAL_FIELD_LABELS[f]])),
};
/** Di bawah ambang ini, import memicu banyak Auto-Close -> minta konfirmasi (Bagian 7.4). */
const SMALL_FILE_THRESHOLD = 100;
const MAPPING_PAGE_SIZE = 6;

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
  /** Header yang SENGAJA di-"Abaikan" oleh user (beda dari sekadar belum cocok auto-detect). */
  ignoredHeaders?: Set<string>;
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

async function fetchTemplates(): Promise<MappingTemplate[]> {
  const res = await fetch('/api/import/templates');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/** Kolom siap dilanjut (bukan sedang dibaca/gagal baca). */
function isParsedOk(e: FileEntry) {
  return e.status !== 'parsing' && e.status !== 'error';
}

/** Step terjauh yang valid dicapai berdasarkan kondisi entries SAAT INI (dihitung ulang tiap render, bukan ratchet satu-arah, supaya menghapus/mengubah file bisa menurunkan step lagi). */
function computeMaxReached(entries: FileEntry[]): WizardStep {
  const parsedOk = entries.filter(isParsedOk);
  if (parsedOk.length === 0) return 1;
  const allMapped = parsedOk.every((e) => e.status !== 'needs-mapping');
  if (!allMapped) return 2;
  return 4;
}

type ColumnStatus = 'terdeteksi' | 'perlu-diperiksa' | 'dilewati';

function columnStatus(entry: FileEntry, header: string): ColumnStatus {
  if (entry.ignoredHeaders?.has(header)) return 'dilewati';
  return entry.mapping?.[header] ? 'terdeteksi' : 'perlu-diperiksa';
}

const STATUS_META: Record<ColumnStatus, { label: string; dot: string; text: string }> = {
  terdeteksi: { label: 'Terdeteksi', dot: 'bg-accent-green', text: 'text-accent-green' },
  'perlu-diperiksa': { label: 'Perlu Diperiksa', dot: 'bg-accent-amber', text: 'text-accent-amber' },
  dilewati: { label: 'Dilewati', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
};

export function ImportClient() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [rawStep, setStep] = useState<WizardStep>(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number } | null>(null);
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingTab, setMappingTab] = useState<'perlu' | 'semua'>('perlu');
  const [mappingPage, setMappingPage] = useState(0);
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

  const templatesQuery = useQuery({ queryKey: ['import-templates'], queryFn: fetchTemplates });

  const saveTemplateMutation = useMutation({
    mutationFn: async ({ namaTemplate, mapping }: { namaTemplate: string; mapping: HeaderMapping }) => {
      const res = await fetch('/api/import/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaTemplate, mapping }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.message || body.error);
      return body.data;
    },
    onSuccess: () => {
      toast.success('Template mapping disimpan');
      queryClient.invalidateQueries({ queryKey: ['import-templates'] });
    },
    onError: (err: Error) => toast.error(`Gagal simpan template: ${err.message}`),
  });

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

  function updateMapping(id: string, header: string, field: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id || !e.raw || !e.mapping) return e;
        const mapping = { ...e.mapping, [header]: field === IGNORE ? null : (field as (typeof CANONICAL_FIELDS)[number]) };
        const ignoredHeaders = new Set(e.ignoredHeaders);
        if (field === IGNORE) ignoredHeaders.add(header);
        else ignoredHeaders.delete(header);
        const mappedRows = computeMapped(e.raw, mapping);
        return { ...e, mapping, ignoredHeaders, mappedRows, status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping' };
      }),
    );
  }

  function applyTemplate(id: string, template: MappingTemplate) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id || !e.raw) return e;
        const mapping: HeaderMapping = {};
        e.raw.headers.forEach((h) => {
          const field = template.mapping[h];
          mapping[h] = (field as (typeof CANONICAL_FIELDS)[number]) ?? null;
        });
        const mappedRows = computeMapped(e.raw, mapping);
        return { ...e, mapping, ignoredHeaders: new Set(), mappedRows, status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping' };
      }),
    );
  }

  /** "Kembalikan Otomatis": buang override manual, kembali ke hasil autoDetectMapping utk SEMUA file. */
  function resetAllToAuto() {
    setEntries((prev) =>
      prev.map((e) => {
        if (!e.raw) return e;
        const mapping = autoDetectMapping(e.raw.headers);
        const mappedRows = computeMapped(e.raw, mapping);
        return { ...e, mapping, ignoredHeaders: new Set(), mappedRows, status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping' };
      }),
    );
    toast.success('Pemetaan dikembalikan ke deteksi otomatis');
  }

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
    () => mergeAndDedup(entries.filter((e) => e.mappedRows).map((e) => e.mappedRows!)),
    [entries],
  );
  const totalBaris = parsedOkEntries.reduce((sum, e) => sum + (e.rawRowCount ?? 0), 0);
  const errorCount = entries.filter((e) => e.status === 'error').length;

  // Statistik agregat step Mapping (dihitung lintas SEMUA file yang berhasil dibaca).
  const mappingStats = useMemo(() => {
    let terdeteksi = 0, perluDiperiksa = 0, dilewati = 0, tidakDitemukan = 0;
    for (const e of parsedOkEntries) {
      if (!e.headers) continue;
      for (const h of e.headers) {
        const s = columnStatus(e, h);
        if (s === 'terdeteksi') terdeteksi++;
        else if (s === 'dilewati') dilewati++;
        else perluDiperiksa++;
      }
      const mappedFields = new Set(Object.values(e.mapping ?? {}).filter(Boolean));
      tidakDitemukan += CANONICAL_FIELDS.filter((f) => !mappedFields.has(f)).length;
    }
    return { terdeteksi, perluDiperiksa, dilewati, tidakDitemukan, totalKolom: terdeteksi + perluDiperiksa + dilewati };
  }, [parsedOkEntries]);

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
              mappingStats={mappingStats}
            />
          )}

          {step === 2 && (
            <StepMapping
              entries={parsedOkEntries}
              search={mappingSearch}
              setSearch={setMappingSearch}
              tab={mappingTab}
              setTab={setMappingTab}
              page={mappingPage}
              setPage={setMappingPage}
              stats={mappingStats}
              templates={templatesQuery.data}
              onUpdateMapping={updateMapping}
              onApplyTemplate={applyTemplate}
              onResetAllToAuto={resetAllToAuto}
              onSaveTemplate={(mapping, name) => saveTemplateMutation.mutate({ namaTemplate: name, mapping })}
            />
          )}

          {step === 3 && (
            <StepPreview
              rows={combined.rows}
              totalBaris={totalBaris}
              totalWaybillUnik={combined.rows.length}
              duplicate={combined.duplicateCount}
              fileCount={parsedOkEntries.length}
            />
          )}

          {step === 4 && (
            <StepImport
              fileNames={entries.filter((e) => e.status === 'ready' || e.status === 'importing' || e.status === 'imported').map((e) => e.fileName)}
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
            {step < 4 && (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1 && parsedOkEntries.length === 0) {
                    toast.error('Upload minimal satu file yang berhasil dibaca dulu');
                    return;
                  }
                  if (step === 2 && parsedOkEntries.some((e) => e.status === 'needs-mapping')) {
                    toast.error('Masih ada kolom wajib (No. Waybill) yang belum dipetakan');
                    return;
                  }
                  setStep(step < 4 ? ((step + 1) as WizardStep) : step);
                }}
              >
                {step === 1 ? 'Lanjut ke Validasi & Mapping' : step === 2 ? 'Lanjut ke Preview Data' : 'Lanjut ke Import Data'}
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
  mappingStats,
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
  mappingStats: { terdeteksi: number; totalKolom: number };
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
        <p className="text-muted-foreground mt-1 text-xs">Bisa upload beberapa file sekaligus (5-6 file H-20) · XLSX, XLS, CSV</p>
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
                  e.status === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-border',
                )}
              >
                <FileSpreadsheet
                  className={cn('size-5 shrink-0', e.status === 'error' ? 'text-destructive' : 'text-accent-green')}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatSize(e.fileSize)}
                    {e.status === 'parsing' && ' · membaca…'}
                    {e.status === 'error' && ` · ${e.error}`}
                    {isParsedOk(e) && e.rawRowCount != null && ` · ${e.rawRowCount.toLocaleString('id-ID')} baris`}
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

          {mappingStats.totalKolom > 0 && (
            <div className="border-accent-green/30 bg-accent-green/5 flex items-start gap-2 rounded-lg border p-3">
              <CheckCircle2 className="text-accent-green mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-xs">
                Sistem berhasil memetakan{' '}
                <span className="font-semibold">
                  {mappingStats.terdeteksi} dari {mappingStats.totalKolom} kolom
                </span>{' '}
                secara otomatis. Lanjut ke langkah berikutnya untuk memeriksa detailnya.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// STEP 2 — Validasi & Mapping
// ============================================================================

function StepMapping({
  entries,
  search,
  setSearch,
  tab,
  setTab,
  page,
  setPage,
  stats,
  templates,
  onUpdateMapping,
  onApplyTemplate,
  onResetAllToAuto,
  onSaveTemplate,
}: {
  entries: FileEntry[];
  search: string;
  setSearch: (v: string) => void;
  tab: 'perlu' | 'semua';
  setTab: (v: 'perlu' | 'semua') => void;
  page: number;
  setPage: (v: number) => void;
  stats: { terdeteksi: number; perluDiperiksa: number; tidakDitemukan: number; dilewati: number; totalKolom: number };
  templates: MappingTemplate[] | undefined;
  onUpdateMapping: (id: string, header: string, field: string) => void;
  onApplyTemplate: (id: string, template: MappingTemplate) => void;
  onResetAllToAuto: () => void;
  onSaveTemplate: (mapping: HeaderMapping, name: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada file yang berhasil dibaca. Kembali ke langkah Upload File.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="border-accent-green/30 bg-accent-green/5 flex items-center gap-2 rounded-lg border p-3">
        <CheckCircle2 className="text-accent-green size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Pemetaan Otomatis Berhasil</p>
          <p className="text-muted-foreground text-xs">
            {stats.terdeteksi} dari {stats.totalKolom} kolom berhasil dipetakan otomatis.{' '}
            {stats.perluDiperiksa > 0 && `${stats.perluDiperiksa} kolom perlu Anda periksa.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 @sm:grid-cols-4">
        <StatCard label="Kolom Terdeteksi" value={stats.terdeteksi} icon={CheckCircle2} accent="green" />
        <StatCard label="Perlu Diperiksa" value={stats.perluDiperiksa} icon={AlertTriangle} accent="amber" />
        <StatCard label="Tidak Ditemukan" value={stats.tidakDitemukan} icon={MinusCircle} accent="violet" />
        <StatCard label="Dilewati" value={stats.dilewati} icon={XCircle} accent="blue" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            placeholder="Cari kolom file atau sistem…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        <div className="border-border inline-flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => {
              setTab('perlu');
              setPage(0);
            }}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              tab === 'perlu' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Perlu Diperiksa ({stats.perluDiperiksa})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('semua');
              setPage(0);
            }}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              tab === 'semua' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Semua Kolom ({stats.totalKolom})
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onResetAllToAuto} className="ml-auto">
          <RotateCcw className="size-3.5" aria-hidden /> Kembalikan Otomatis
        </Button>
      </div>

      {entries.map((entry) => (
        <MappingFileGroup
          key={entry.id}
          entry={entry}
          search={search}
          tab={tab}
          page={page}
          setPage={setPage}
          templates={templates}
          onUpdateMapping={onUpdateMapping}
          onApplyTemplate={onApplyTemplate}
          onSaveTemplate={onSaveTemplate}
        />
      ))}
    </div>
  );
}

function MappingFileGroup({
  entry,
  search,
  tab,
  page,
  setPage,
  templates,
  onUpdateMapping,
  onApplyTemplate,
  onSaveTemplate,
}: {
  entry: FileEntry;
  search: string;
  tab: 'perlu' | 'semua';
  page: number;
  setPage: (v: number) => void;
  templates: MappingTemplate[] | undefined;
  onUpdateMapping: (id: string, header: string, field: string) => void;
  onApplyTemplate: (id: string, template: MappingTemplate) => void;
  onSaveTemplate: (mapping: HeaderMapping, name: string) => void;
}) {
  const headers = entry.headers ?? [];
  const needle = search.trim().toLowerCase();
  const filtered = headers.filter((h) => {
    if (tab === 'perlu' && columnStatus(entry, h) !== 'perlu-diperiksa') return false;
    if (!needle) return true;
    const target = entry.mapping?.[h];
    const targetLabel = target ? CANONICAL_FIELD_LABELS[target] : '';
    return h.toLowerCase().includes(needle) || targetLabel.toLowerCase().includes(needle);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / MAPPING_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * MAPPING_PAGE_SIZE, (safePage + 1) * MAPPING_PAGE_SIZE);

  return (
    <div className="border-border rounded-lg border">
      <div className="border-border bg-muted/40 flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <FileSpreadsheet className="text-muted-foreground size-4" aria-hidden />
          {entry.fileName}
        </div>
        {templates && templates.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Label className="text-muted-foreground text-xs">Muat Template:</Label>
            <Select
              items={Object.fromEntries(templates.map((t) => [t.namaTemplate, t.namaTemplate]))}
              onValueChange={(v) => {
                const t = templates.find((tpl) => tpl.namaTemplate === v);
                if (t) onApplyTemplate(entry.id, t);
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-48 text-xs">
                <SelectValue placeholder="Pilih template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.namaTemplate} value={t.namaTemplate}>
                    {t.namaTemplate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="p-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {tab === 'perlu' ? 'Semua kolom di file ini sudah beres — tidak ada yang perlu diperiksa.' : 'Tidak ada kolom yang cocok dengan pencarian.'}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kolom di File (Excel)</TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Dipetakan ke (Sistem)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((header) => {
                  const status = columnStatus(entry, header);
                  const meta = STATUS_META[status];
                  return (
                    <TableRow key={header}>
                      <TableCell className="font-mono text-xs">{header}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">→</TableCell>
                      <TableCell>
                        <Select
                          items={mappingItems}
                          value={entry.mapping?.[header] ?? IGNORE}
                          onValueChange={(v) => onUpdateMapping(entry.id, header, v as string)}
                        >
                          <SelectTrigger size="sm" className="w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE}>Abaikan kolom ini</SelectItem>
                            {CANONICAL_FIELDS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {CANONICAL_FIELD_LABELS[f]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.text)}>
                          <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
                          {meta.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filtered.length > MAPPING_PAGE_SIZE && (
              <div className="mt-2">
                <TablePager
                  pageIndex={safePage}
                  pageCount={pageCount}
                  onGoto={setPage}
                  canPrev={safePage > 0}
                  canNext={safePage < pageCount - 1}
                  totalRows={filtered.length}
                  pageSize={MAPPING_PAGE_SIZE}
                  onPageSizeChange={() => {}}
                  pageSizeOptions={[MAPPING_PAGE_SIZE]}
                />
              </div>
            )}
          </>
        )}

        <SaveTemplateRow mapping={entry.mapping} onSave={(name) => onSaveTemplate(entry.mapping!, name)} />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3 — Preview Data
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
// STEP 4 — Import Data
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

function SaveTemplateRow({ mapping, onSave }: { mapping: HeaderMapping | undefined; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  if (!mapping || !isMappingComplete(mapping)) return null;
  return (
    <div className="mt-3 flex items-center gap-2">
      <Input
        placeholder="Nama template (mis. Template JMS Standar)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 max-w-64 text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!name.trim()}
        onClick={() => {
          onSave(name.trim());
          setName('');
        }}
      >
        Simpan sebagai Template
      </Button>
    </div>
  );
}
