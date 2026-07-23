import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

/**
 * Halaman yang menunya sudah aktif di sidebar tapi isinya dibangun di fase
 * berikutnya. Sengaja tetap bisa dibuka (bukan menu terkunci/redup) supaya
 * navigasi terasa utuh.
 */
export function PlaceholderPage({
  title,
  description,
  fase,
}: {
  title: string;
  description: string;
  fase: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="bg-muted text-muted-foreground mx-auto flex size-11 items-center justify-center rounded-xl">
            <Construction className="size-5" aria-hidden />
          </div>
          <h2 className="mt-3 text-sm font-medium">Halaman sedang dibangun</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs">
            Isi halaman ini dikerjakan pada {fase}. Menu sengaja tetap dapat diakses agar struktur
            navigasi sudah final.
          </p>
        </div>
      </div>
    </>
  );
}
