import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';

const OWNER_LINKS = [
  { href: '/admin', key: 'admin' },
  { href: '/orders', key: 'orders' },
  { href: '/menu', key: 'menu' },
  { href: '/inventory', key: 'inventory' },
  { href: '/customers', key: 'customers' },
  { href: '/campaigns', key: 'campaigns' },
  { href: '/finance/pnl', key: 'finance' },
  { href: '/settings', key: 'settings' },
];

const STAFF_LINKS = [
  { href: '/staff', key: 'staff' },
  { href: '/orders', key: 'orders' },
  { href: '/menu', key: 'menu' },
  { href: '/inventory', key: 'inventory' },
  { href: '/customers', key: 'customers' },
];

export async function AppNav() {
  const session = await auth();
  const cookieStore = await cookies();
  const locale = (cookieStore.get('NEXT_LOCALE')?.value as 'vi' | 'en') ?? 'vi';
  const t = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  const role = session?.user?.role;
  const links = role === 'owner' ? OWNER_LINKS : role === 'staff' ? STAFF_LINKS : [];

  return (
    <header className="border-b bg-background sticky top-0 z-30">
      <div className="container flex h-14 items-center gap-4">
        <Link href={role === 'owner' ? '/admin' : role === 'staff' ? '/staff' : '/'} className="flex items-center gap-2">
          <BrandLogo variant="mark" size="sm" />
          <BrandLogo variant="wordmark" size="sm" />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm flex-1 ml-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-md text-foreground/70 hover:text-foreground hover:bg-muted"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher currentLocale={locale} />
          {session?.user ? (
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/signin' });
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                {tAuth('signout')}
              </Button>
            </form>
          ) : (
            <Link href="/signin">
              <Button size="sm">{tAuth('signin.submit')}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
