'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export function SigninForm() {
  const t = useTranslations('auth.signin');
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/admin';
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // CSRF cold-cookie warmup per .claude/rules/signin-test.md — prevents the
  // first-attempt-fails-second-works regression.
  useEffect(() => {
    fetch('/api/auth/csrf', { credentials: 'include' }).catch(() => {});
  }, []);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await signIn('credentials', {
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        redirect: false,
      });
      if (res?.error) {
        setError(t('error'));
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden flex justify-center">
        <BrandLogo variant="both" size="md" />
      </div>
      <div>
        <h1 className="text-2xl font-display italic text-cocoa">{t('title')}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t('demo_hint')}</p>
      </div>

      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? '...' : t('submit')}
        </Button>
      </form>
    </div>
  );
}
