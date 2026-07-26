'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LongTailRow } from '@/lib/data/longtail';
import type { MasterFeedbackRow } from '@/lib/data/master-feedback';
import type { FavoriteFeedbackRow } from '@/lib/data/favorite-feedback';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

export type SubmitFeedbackError = Error & { code?: string; currentRow?: LongTailRow };

export function useLongTail() {
  return useQuery({ queryKey: ['longtail'], queryFn: () => getJson<LongTailRow[]>('/api/longtail') });
}

export function useMasterFeedback() {
  return useQuery({ queryKey: ['master-feedback'], queryFn: () => getJson<MasterFeedbackRow[]>('/api/master-feedback') });
}

export function useFavoriteFeedback() {
  return useQuery({ queryKey: ['favorite-feedback'], queryFn: () => getJson<FavoriteFeedbackRow[]>('/api/favorite-feedback') });
}

/**
 * Combobox options (Bagian 11 PRD): favorit dulu (urut Urutan), lalu master
 * yang aktif, tanpa duplikat. Type-to-search + free text ditangani <datalist>.
 */
export function useFeedbackOptions(): string[] {
  const master = useMasterFeedback();
  const fav = useFavoriteFeedback();
  const seen = new Set<string>();
  const options: string[] = [];
  const favSorted = [...(fav.data ?? [])].sort((a, b) => (Number(a.Urutan) || 0) - (Number(b.Urutan) || 0));
  for (const f of favSorted) {
    const name = String(f['Nama Feedback']).trim();
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); options.push(name); }
  }
  for (const m of master.data ?? []) {
    if (String(m['Status Aktif']).trim().toLowerCase() !== 'aktif') continue;
    const name = String(m['Nama Feedback']).trim();
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); options.push(name); }
  }
  return options;
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { waybill: string; feedback: string; baseVersion?: string }) => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const body = await res.json();
      if (!body.ok) {
        const err: SubmitFeedbackError = Object.assign(new Error(body.message || body.error), {
          code: body.error as string,
          currentRow: body.data as LongTailRow | undefined,
        });
        throw err;
      }
      return body.data as LongTailRow;
    },
    // Optimistic update: teks langsung tampil & tersimpan di cache begitu Enter,
    // backend menyusul di belakang layar. Mencegah teks "hilang sesaat" —
    // terasa natural spt isi formulir web biasa.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['longtail'] });
      const prev = qc.getQueryData<LongTailRow[]>(['longtail']);
      qc.setQueryData<LongTailRow[]>(['longtail'], (old) =>
        old?.map((r) =>
          r['No. Waybill'] === vars.waybill
            ? { ...r, Feedback: vars.feedback, 'Status Terakhir': vars.feedback }
            : r,
        ),
      );
      return { prev };
    },
    onSuccess: (updated) => {
      // Ganti dengan baris server final (versi/__isClearTTD/Log yang benar).
      qc.setQueryData<LongTailRow[]>(['longtail'], (old) =>
        old?.map((r) => (r['No. Waybill'] === updated['No. Waybill'] ? updated : r)),
      );
    },
    onError: (err: SubmitFeedbackError, _vars, ctx) => {
      // VERSION_CONFLICT membawa baris terkini → tampilkan versi server itu.
      if (err.code === 'VERSION_CONFLICT' && err.currentRow) {
        qc.setQueryData<LongTailRow[]>(['longtail'], (old) =>
          old?.map((r) => (r['No. Waybill'] === err.currentRow!['No. Waybill'] ? err.currentRow! : r)),
        );
      } else if (ctx?.prev) {
        // Error lain → batalkan optimistic (kembalikan snapshot sebelum submit).
        qc.setQueryData<LongTailRow[]>(['longtail'], ctx.prev);
      }
    },
  });
}
