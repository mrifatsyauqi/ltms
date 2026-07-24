import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Aksi di kanan (mis. tombol Refresh). Sengaja TIDAK ada lonceng notifikasi
   *  & TIDAK ada date picker - Dashboard & Feedback selalu real-time. */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="text-base leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
