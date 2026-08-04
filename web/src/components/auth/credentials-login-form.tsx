'use client';

import { useActionState, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { credentialsSignInAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function CredentialsLoginForm() {
  const [error, formAction, pending] = useActionState(credentialsSignInAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [identifier, setIdentifier] = useState('');

  useEffect(() => {
    // localStorage tidak tersedia saat SSR; baca setelah mount (bukan lazy
    // initializer) supaya render pertama cocok dgn server -> hindari hydration
    // mismatch pada <input value>. Sengaja hanya jalan sekali saat mount.
    const saved = localStorage.getItem('ltms-remember-email');
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdentifier(saved);
      setRemember(true);
    }
  }, []);

  const handleSubmit = (formData: FormData) => {
    if (remember) {
      localStorage.setItem('ltms-remember-email', formData.get('identifier') as string);
    } else {
      localStorage.removeItem('ltms-remember-email');
    }
    formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="identifier">NIK / Email</Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          placeholder="NIK atau email terdaftar"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="remember" name="remember" checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
        <label htmlFor="remember" className="text-muted-foreground text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Simpan NIK/Email
        </label>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            <span>Memproses Masuk...</span>
          </>
        ) : (
          'Masuk'
        )}
      </Button>
    </form>
  );
}
