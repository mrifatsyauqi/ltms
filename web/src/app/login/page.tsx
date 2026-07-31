import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CredentialsLoginForm } from '@/components/auth/credentials-login-form';

export default async function LoginPage() {
  const session = await auth();
  // Hanya redirect kalau sesi benar-benar valid (punya role). Sesi setengah
  // jadi (tanpa role) dibiarkan di halaman login — konsisten dgn (app)/layout,
  // supaya tidak terjadi loop redirect & user bisa login ulang dengan benar.
  if (session?.user?.role) {
    redirect('/');
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex justify-center">
          <Image
            src="/branding/logo-full-tagline.png"
            alt="LTMS - Longtail Monitoring System"
            width={210}
            height={181}
            priority
            className="h-auto w-[210px]"
          />
        </CardHeader>
        <CardContent>
          {/* NIK+Password = jalur utama (migrasi Google->NIK, masa transisi
              dual-mode). Google didemosikan jadi opsi sekunder di bawah -
              dipertahankan sampai SEMUA user existing terkonfirmasi punya
              NIK+password (lihat rencana rollout migrasi auth). */}
          <CredentialsLoginForm />

          <div className="my-4 flex items-center gap-2">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">atau</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Sign in with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
