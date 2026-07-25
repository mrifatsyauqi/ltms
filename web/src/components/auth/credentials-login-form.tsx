'use client';

import { useActionState } from 'react';
import { credentialsSignInAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CredentialsLoginForm() {
  const [error, formAction, pending] = useActionState(credentialsSignInAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="username" placeholder="nama@email.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? 'Masuk…' : 'Masuk dengan Email'}
      </Button>
    </form>
  );
}
