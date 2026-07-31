import { LinkIcon } from 'lucide-react';

/**
 * Pesan GENERIK saat token tidak valid - sengaja tak membedakan "tidak
 * ditemukan" vs "sudah di-revoke" (tak beri info yg bisa dipakai menebak
 * token lain / status link).
 */
export function InvalidLinkMessage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <span className="bg-muted text-muted-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
          <LinkIcon className="size-5" aria-hidden />
        </span>
        <p className="text-lg font-semibold">Link tidak valid</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Link ini sudah tidak aktif atau tidak ditemukan. Hubungi Admin Cabang untuk mendapatkan link laporan
          terbaru.
        </p>
      </div>
    </div>
  );
}
