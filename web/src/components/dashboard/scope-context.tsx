'use client';

import { createContext, useContext, useState } from 'react';

/** Nilai filter untuk mode "seluruh DP" (agregat). */
export const ALL_SCOPE = 'ALL';

type ScopeContextValue = {
  /** 'ALL' = semua DP (default), selain itu = Kode DP terpilih. */
  scope: string;
  setScope: (s: string) => void;
};

const ScopeContext = createContext<ScopeContextValue | null>(null);

/**
 * State filter CAKUPAN global. Dipasang di (app)/layout supaya sidebar (yang
 * memuat dropdown-nya) dan Dashboard (yang memakainya untuk query) berbagi
 * state yang sama tanpa prop-drilling.
 */
export function DashboardScopeProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<string>(ALL_SCOPE);
  return <ScopeContext.Provider value={{ scope, setScope }}>{children}</ScopeContext.Provider>;
}

export function useDashboardScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useDashboardScope harus dipakai di dalam DashboardScopeProvider');
  return ctx;
}
