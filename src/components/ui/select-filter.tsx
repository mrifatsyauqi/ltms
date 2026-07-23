import { cn } from '@/lib/utils';

type Option = { value: string; label: string };

type SelectFilterProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
};

/** Dropdown filter standar (native select) - dipakai di semua tabel. */
export function SelectFilter({ label, value, onChange, options, className }: SelectFilterProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'border-input bg-background h-8 rounded-md border px-2 text-xs',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
