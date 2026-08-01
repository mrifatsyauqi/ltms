// Fake Postgrest-like query builder utk test persisten yang menjalankan
// fungsi produksi ASLI (mock.module() hanya intercept db() di client.ts).
// Dipakai access-control.test.ts & import.test.ts - diekstrak ke sini
// supaya tak diduplikasi di tiap file test (dulu disalin, gampang mulai
// beda perilaku tanpa disadari).
export type Row = Record<string, unknown>;

export class FakeQuery {
  private filters: Array<['eq' | 'in' | 'gte' | 'lte', string, unknown]> = [];
  private mode: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private upsertKey: string | null = null;
  private wantSingle = false;
  private wantCount = false;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private table: string;
  private store: Map<string, Row[]>;

  constructor(table: string, store: Map<string, Row[]>) {
    this.table = table;
    this.store = store;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this.wantCount = true;
    return this;
  }
  eq(col: string, val: unknown) { this.filters.push(['eq', col, val]); return this; }
  in(col: string, vals: unknown[]) { this.filters.push(['in', col, vals]); return this; }
  gte(col: string, val: unknown) { this.filters.push(['gte', col, val]); return this; }
  lte(col: string, val: unknown) { this.filters.push(['lte', col, val]); return this; }
  not() { return this; } // dipakai reset-longtail sbg guard "semua baris" - tak relevan di test
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitCount = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  maybeSingle() { this.wantSingle = true; return this; }
  update(patch: Row) { this.mode = 'update'; this.payload = patch; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert'; this.payload = rows; this.upsertKey = opts?.onConflict ?? 'id'; return this;
  }
  insert(rows: Row | Row[]) { this.mode = 'insert'; this.payload = rows; return this; }
  delete() { this.mode = 'delete'; return this; }

  private matches(r: Row): boolean {
    return this.filters.every(([op, col, val]) => {
      if (op === 'eq') return String(r[col] ?? '') === String(val ?? '');
      if (op === 'in') return (val as unknown[]).some((v) => String(v) === String(r[col]));
      if (op === 'gte') return String(r[col]) >= String(val);
      if (op === 'lte') return String(r[col]) <= String(val);
      return true;
    });
  }

  then(resolve: (v: { data: unknown; error: null; count?: number }) => void) {
    const table = this.store.get(this.table) ?? [];
    if (this.mode === 'select') {
      let rows = table.filter((r) => this.matches(r));
      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        rows = [...rows].sort((a, b) => {
          const av = String(a[col] ?? '');
          const bv = String(b[col] ?? '');
          return ascending ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
        });
      }
      if (this.rangeFrom != null) rows = rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length) + 1);
      if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
      if (this.wantCount) return resolve({ data: null, error: null, count: rows.length });
      if (this.wantSingle) return resolve({ data: rows[0] ?? null, error: null });
      return resolve({ data: rows, error: null });
    }
    if (this.mode === 'update') {
      const matched = table.filter((r) => this.matches(r));
      matched.forEach((r) => Object.assign(r, this.payload));
      return resolve({ data: this.wantSingle ? (matched[0] ?? null) : matched, error: null });
    }
    if (this.mode === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => ({ ...r }));
      table.push(...rows);
      return resolve({ data: rows, error: null });
    }
    if (this.mode === 'upsert') {
      // onConflict bisa composite ('role,menu_key') - cocokkan SEMUA kolomnya,
      // bukan cuma treat string gabungan itu sbg satu nama kolom literal
      // (yg tak pernah match apa pun -> upsert jadi selalu INSERT/duplikat).
      const keyCols = this.upsertKey!.split(',').map((c) => c.trim());
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const r of rows) {
        const idx = table.findIndex((t) => keyCols.every((col) => t[col] === r[col]));
        if (idx >= 0) table[idx] = { ...table[idx], ...r };
        else table.push({ ...r });
      }
      return resolve({ data: rows, error: null });
    }
    if (this.mode === 'delete') {
      const matched = table.filter((r) => this.matches(r));
      this.store.set(this.table, table.filter((r) => !matched.includes(r)));
      return resolve({ data: matched, error: null });
    }
    return resolve({ data: null, error: null });
  }
}

/**
 * `getStore` (bukan Map langsung) SENGAJA - kalau test-nya reassign `store`
 * di beforeEach (mis. `store = freshStore()` supaya tiap test terisolasi),
 * db() yg dihasilkan di sini tetap membaca nilai TERKINI tiap dipanggil,
 * bukan snapshot Map lama dari saat mock.module() didaftarkan sekali di before().
 */
export function fakeDbFactory(getStore: () => Map<string, Row[]>) {
  return () => ({ from: (table: string) => new FakeQuery(table, getStore()) });
}
