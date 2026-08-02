import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
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
          <CredentialsLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
