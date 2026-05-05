'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function LocaleSwitcher({ currentLocale }: { currentLocale: 'vi' | 'en' }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const setLocale = (locale: 'vi' | 'en') => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  };
  return (
    <div className="flex items-center gap-1 text-xs" aria-label="Language switcher">
      <button
        type="button"
        onClick={() => setLocale('vi')}
        className={`px-2 py-1 rounded ${currentLocale === 'vi' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        disabled={pending}
      >
        VI
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`px-2 py-1 rounded ${currentLocale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        disabled={pending}
      >
        EN
      </button>
    </div>
  );
}
