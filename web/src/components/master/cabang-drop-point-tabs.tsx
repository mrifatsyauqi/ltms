'use client';

import { useState } from 'react';
import { Building2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CabangClient } from '@/components/master/cabang-client';
import { DropPointClient } from '@/components/master/drop-point-client';

type Tab = 'kota' | 'drop-point';

/**
 * Halaman Cabang (Super Admin, atau akun full access mana pun yang diberi
 * akses master_cabang lewat "Per Akun") mengelola Kota DAN Drop Point dari
 * SATU halaman - tab switcher tipis di atas CabangClient/DropPointClient
 * yang DIREUSE APA ADANYA (tanpa perubahan internal sama sekali, tanpa
 * duplikasi data/logic - keduanya tetap fetch dari endpoint masing2 yang
 * sama dgn yang dipakai sidebar Admin Cabang dkk utk /master/drop-point).
 *
 * `canManageDropPoint`: dihitung di page.tsx dari access.master_drop_point
 * aktor (bukan diasumsikan true) - kasus tepi kalau Super Admin memberi
 * master_cabang=true tapi master_drop_point=false ke suatu akun, tab Drop
 * Point disembunyikan sama sekali (bukan cuma disabled) supaya tak ada
 * jalur UI yang membuka fitur yang menu_key-nya sendiri sedang dimatikan -
 * requirePermission('master_drop_point') di data-layer (createDropPoint dkk,
 * cabang.ts/drop-points.ts) tetap jadi penjaga sesungguhnya, ini cuma UX.
 */
export function CabangDropPointTabs({ canManageDropPoint }: { canManageDropPoint: boolean }) {
  const [tab, setTab] = useState<Tab>('kota');

  if (!canManageDropPoint) return <CabangClient />;

  return (
    <>
      <div className="flex items-center gap-1 border-b px-4" role="tablist" aria-label="Kelola Cabang">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'kota'}
          onClick={() => setTab('kota')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
            tab === 'kota'
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          <Building2 className="size-3.5" aria-hidden /> Kota
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'drop-point'}
          onClick={() => setTab('drop-point')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
            tab === 'drop-point'
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          <Database className="size-3.5" aria-hidden /> Drop Point
        </button>
      </div>
      {tab === 'kota' ? <CabangClient /> : <DropPointClient />}
    </>
  );
}
