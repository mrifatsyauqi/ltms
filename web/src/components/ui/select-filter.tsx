import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Option = { value: string; label: string };

type SelectFilterProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
};

// base-ui Select menganggap value yang stringify jadi '' sebagai "belum
// dipilih" (placeholder ditampilkan, bukan label opsi) — sementara banyak
// filter di app ini memakai value:'' untuk opsi "Semua X". Sentinel non-kosong
// dipakai internal, dipetakan balik ke '' di batas komponen supaya kontrak
// props (value/onChange/options ber-value '') tidak berubah bagi pemakai.
const EMPTY_SENTINEL = '__sf_empty__';

/** Dropdown filter standar (UI custom, konsisten lintas browser/OS) - dipakai di semua tabel. */
export function SelectFilter({ label, value, onChange, options, className }: SelectFilterProps) {
  // WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
  // SelectValue (trigger) bisa menampilkan label yang benar. Tanpa ini, ia
  // fallback ke value MENTAH (bug: trigger menampilkan "__sf_empty__"/kode
  // internal, bukan label opsi) — merender <SelectItem> saja tidak cukup.
  const items = Object.fromEntries(options.map((o) => [o.value === '' ? EMPTY_SENTINEL : o.value, o.label]));

  return (
    <Select
      items={items}
      value={value === '' ? EMPTY_SENTINEL : value}
      onValueChange={(v) => onChange(v === EMPTY_SENTINEL ? '' : (v ?? ''))}
    >
      <SelectTrigger aria-label={label} className={cn('h-8 gap-1 px-2 text-xs', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value === '' ? EMPTY_SENTINEL : o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
