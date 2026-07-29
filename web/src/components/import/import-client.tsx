'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseFiles } from '@/lib/import/parse';
import { autoDetectMapping, isMappingComplete } from '@/lib/import/mapping';
import { applyMapping, mergeAndDedup } from '@/lib/import/dedup';
import { CANONICAL_FIELDS, CANONICAL_FIELD_LABELS, type HeaderMapping, type MappedRow } from '@/lib/import/types';
import type { ImportResult, MappingTemplate } from '@/lib/data/import';
import { ImportHistory } from './import-history';

const IGNORE = '__ignore__';
/** Di bawah ambang ini, import memicu banyak Auto-Close -> minta konfirmasi (Bagian 7.4). */
const SMALL_FILE_THRESHOLD = 100;

// 'import-error' SENGAJA tidak ada: kegagalan submit adalah kegagalan BATCH
// gabungan (lihat handleImportAll), bukan per-file — entry kembali ke 'ready'
// supaya tombol Import yang sama bisa dipakai retry.
type EntryStatus = 'parsing' | 'error' | 'needs-mapping' | 'ready' | 'importing' | 'imported';

type FileEntry = {
  id: string;
  fileName: string;
  status: EntryStatus;
  headers?: string[];
  mapping?: HeaderMapping;
  mappedRows?: MappedRow[];
  error?: string;
  raw?: import('@/lib/import/types').ParsedFile;
};

function computeMapped(parsed: import('@/lib/import/types').ParsedFile, mapping: HeaderMapping) {
  return mergeAndDedup([applyMapping(parsed, mapping)]).rows;
}

async function fetchTemplates(): Promise<MappingTemplate[]> {
  const res = await fetch('/api/import/templates');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

export function ImportClient() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  // Konfirmasi batch KECIL (<100 baris GABUNGAN, bukan per-file lagi).
  const [smallConfirm, setSmallConfirm] = useState<{ count: number; resolve: (ok: boolean) => void } | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchResult, setBatchResult] = useState<{ fileNames: string[]; result: ImportResult } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /** Konfirmasi batch kecil (<100 baris gabungan) sebelum import; resolve(true)=lanjut. */
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
    // Hasil/error import batch sebelumnya sudah tidak relevan begitu ada file baru.
    setBatchResult(null);
    setBatchError(null);

    setEntries((prev) => [...prev, ...files.map((f, i) => ({ id: ids[i], fileName: f.name, status: 'parsing' as const }))]);

    const results = await parseFiles(files);

    setEntries((prev) => {
      const next = [...prev];
      results.forEach((result, i) => {
        const idx = next.findIndex((e) => e.id === ids[i]);
        if (idx === -1) return;
        if (!result.ok) {
          next[idx] = { ...next[idx], status: 'error', error: result.error };
          return;
        }
        const mapping = autoDetectMapping(result.file.headers);
        const mappedRows = computeMapped(result.file, mapping);
        next[idx] = {
          ...next[idx],
          raw: result.file,
          headers: result.file.headers,
          mapping,
          mappedRows,
          status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping',
        };
      });
      return next;
    });
  }, []);

  function updateMapping(id: string, header: string, field: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id || !e.raw || !e.mapping) return e;
        const mapping = { ...e.mapping, [header]: field === IGNORE ? null : (field as (typeof CANONICAL_FIELDS)[number]) };
        const mappedRows = computeMapped(e.raw, mapping);
        return { ...e, mapping, mappedRows, status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping' };
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
        return { ...e, mapping, mappedRows, status: isMappingComplete(mapping) ? 'ready' : 'needs-mapping' };
      }),
    );
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
    try {
      const fileNames = ready.map((e) => e.fileName);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fileNames.join(', '), rows: combined.rows }),
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
      const message = err instanceof Error ? err.message : 'Gagal import';
      setBatchError(message);
      // Kembali ke 'ready' (bukan status error permanen) supaya tombol Import
      // yang sama bisa dipakai untuk retry seluruh batch.
      setEntries((prev) => prev.map((e) => (readyIds.has(e.id) ? { ...e, status: 'ready' } : e)));
      toast.error(`Gagal import: ${message}`);
    } finally {
      setBatchImporting(false);
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const readyCount = entries.filter((e) => e.status === 'ready').length;
  const combined = mergeAndDedup(entries.filter((e) => e.mappedRows).map((e) => e.mappedRows!));

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardContent
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dragOver ? 'border-primary bg-accent' : 'border-muted-foreground/25'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm">Drag & drop file Excel (.xlsx/.xls/.csv) ke sini, atau</p>
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
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="text-muted-foreground text-xs">Bisa upload beberapa file sekaligus (5-6 file H-20)</p>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-medium">{entry.fileName}</CardTitle>
                <div className="flex items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeEntry(entry.id)}>
                    Hapus
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.status === 'error' && <p className="text-destructive text-sm">{entry.error}</p>}
                {entry.status === 'imported' && (
                  <p className="text-muted-foreground text-sm">
                    Sudah masuk ke batch gabungan — lihat ringkasan hasil di bawah daftar file.
                  </p>
                )}

                {(entry.status === 'needs-mapping' || entry.status === 'ready') && entry.headers && entry.mapping && (
                  <div className="space-y-3">
                    {!isMappingComplete(entry.mapping) && (
                      <p className="text-sm text-amber-600 dark:text-amber-500">
                        Header tidak dikenali sepenuhnya — petakan manual kolom No. Waybill minimal, sebelum bisa Import.
                      </p>
                    )}

                    {templatesQuery.data && templatesQuery.data.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Muat Template:</Label>
                        <Select onValueChange={(v) => {
                          const t = templatesQuery.data?.find((tpl) => tpl.namaTemplate === v);
                          if (t) applyTemplate(entry.id, t);
                        }}>
                          <SelectTrigger size="sm" className="w-56">
                            <SelectValue placeholder="Pilih template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {templatesQuery.data.map((t) => (
                              <SelectItem key={t.namaTemplate} value={t.namaTemplate}>
                                {t.namaTemplate}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kolom di File</TableHead>
                          <TableHead>Dipetakan ke</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.headers.map((header) => (
                          <TableRow key={header}>
                            <TableCell className="font-mono text-xs">{header}</TableCell>
                            <TableCell>
                              <Select
                                value={entry.mapping![header] ?? IGNORE}
                                onValueChange={(v) => updateMapping(entry.id, header, v as string)}
                              >
                                <SelectTrigger size="sm" className="w-64">
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <SaveTemplateRow mapping={entry.mapping} onSave={(name) => saveTemplateMutation.mutate({ namaTemplate: name, mapping: entry.mapping! })} />

                    {entry.mappedRows && (
                      <p className="text-muted-foreground text-xs">{entry.mappedRows.length} baris unik siap diimport dari file ini.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm">
              Total {combined.rows.length} waybill unik dari {entries.length} file ({readyCount} siap import).
            </p>
            <Button type="button" onClick={handleImportAll} disabled={readyCount === 0 || batchImporting}>
              {batchImporting ? 'Mengimport…' : `Import ${readyCount > 0 ? `(${readyCount} file)` : ''}`}
            </Button>
          </div>

          {batchError && (
            <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
              <p className="text-destructive text-sm font-medium">Gagal import batch</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{batchError}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                File yang sudah dipetakan kembali ke status &quot;Siap import&quot; — klik Import lagi untuk mengulang
                seluruh batch (semua file digabung sekaligus, bukan satu per satu).
              </p>
            </div>
          )}

          {batchResult && (
            <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                Hasil import gabungan — {batchResult.fileNames.length} file: {batchResult.fileNames.join(', ')}
              </p>
              <p className="text-muted-foreground mt-1">
                {batchResult.result.inserted} baru • {batchResult.result.updated} update •{' '}
                {batchResult.result.needReview} perlu review • {batchResult.result.skipped} dilewati
                {batchResult.result.closed ? (
                  <>
                    {' '}
                    • {batchResult.result.closed} di-close ({batchResult.result.closedClearTTD ?? 0} Clear TTD,{' '}
                    {batchResult.result.closedAlur ?? 0} Close Alur)
                  </>
                ) : null}
              </p>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Import</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportHistory />
        </CardContent>
      </Card>

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

function StatusBadge({ status }: { status: EntryStatus }) {
  const label: Record<EntryStatus, string> = {
    parsing: 'Membaca file...',
    error: 'Gagal dibaca',
    'needs-mapping': 'Perlu mapping manual',
    ready: 'Siap import',
    importing: 'Mengimport...',
    imported: 'Sudah diimport',
  };
  const color: Record<EntryStatus, string> = {
    parsing: 'text-muted-foreground',
    error: 'text-destructive',
    'needs-mapping': 'text-amber-600 dark:text-amber-500',
    ready: 'text-green-600 dark:text-green-500',
    importing: 'text-muted-foreground',
    imported: 'text-green-600 dark:text-green-500',
  };
  return <span className={`text-xs font-medium ${color[status]}`}>{label[status]}</span>;
}

function SaveTemplateRow({ mapping, onSave }: { mapping: HeaderMapping; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  if (!isMappingComplete(mapping)) return null;
  return (
    <div className="flex items-center gap-2">
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
