'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseFiles } from '@/lib/import/parse';
import { autoDetectMapping, isMappingComplete } from '@/lib/import/mapping';
import { applyMapping, mergeAndDedup } from '@/lib/import/dedup';
import { CANONICAL_FIELDS, CANONICAL_FIELD_LABELS, type HeaderMapping, type MappedRow } from '@/lib/import/types';
import type { ImportResult, MappingTemplate } from '@/lib/apps-script/import';
import { ImportHistory } from './import-history';

const IGNORE = '__ignore__';

type EntryStatus = 'parsing' | 'error' | 'needs-mapping' | 'ready' | 'importing' | 'imported' | 'import-error';

type FileEntry = {
  id: string;
  fileName: string;
  status: EntryStatus;
  headers?: string[];
  mapping?: HeaderMapping;
  mappedRows?: MappedRow[];
  error?: string;
  result?: ImportResult;
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
  const queryClient = useQueryClient();

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

  async function importOne(entry: FileEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'importing' } : e)));
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: entry.fileName, rows: entry.mappedRows }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.message || body.error);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'imported', result: body.data } : e)));
      const r: ImportResult = body.data;
      toast.success(`${entry.fileName}: ${r.inserted} baru, ${r.updated} update, ${r.needReview} perlu review, ${r.skipped} dilewati`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal import';
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'import-error', error: message } : e)));
      toast.error(`${entry.fileName} gagal diimport: ${message}`);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    }
  }

  async function handleImportAll() {
    // Setiap file diproses independen (Bagian 7.3) — kegagalan satu file
    // tidak menghentikan file lain yang sudah siap.
    const ready = entries.filter((e) => e.status === 'ready' && e.mappedRows);
    for (const entry of ready) {
      // eslint-disable-next-line no-await-in-loop
      await importOne(entry);
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
                {entry.status === 'import-error' && (
                  <div className="space-y-2">
                    <p className="text-destructive text-sm">{entry.error}</p>
                    <Button type="button" size="sm" onClick={() => importOne(entry)}>
                      Coba Lagi
                    </Button>
                  </div>
                )}
                {entry.status === 'imported' && entry.result && (
                  <p className="text-sm">
                    {entry.result.inserted} baru • {entry.result.updated} update • {entry.result.needReview} perlu review •{' '}
                    {entry.result.skipped} dilewati
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
            <Button type="button" onClick={handleImportAll} disabled={readyCount === 0}>
              Import {readyCount > 0 ? `(${readyCount} file)` : ''}
            </Button>
          </div>
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
    'import-error': 'Gagal import',
  };
  const color: Record<EntryStatus, string> = {
    parsing: 'text-muted-foreground',
    error: 'text-destructive',
    'needs-mapping': 'text-amber-600 dark:text-amber-500',
    ready: 'text-green-600 dark:text-green-500',
    importing: 'text-muted-foreground',
    imported: 'text-green-600 dark:text-green-500',
    'import-error': 'text-destructive',
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
