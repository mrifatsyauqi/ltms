import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CredentialsLoginForm } from '@/components/auth/credentials-login-form';

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect('/');
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>LTMS</CardTitle>
          <CardDescription>LongTail Dashboard Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <Button type="submit" className="w-full">
              Sign in with Google
            </Button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">atau</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <CredentialsLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
