import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function AppFooter() {
  const t = await getTranslations('brand');
  return (
    <footer className="border-t bg-cream/40 mt-auto">
      <div className="container py-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <span>{t('footer_madewith')}</span>
        <nav className="flex items-center gap-4">
          <Link href="/legal/privacy" className="hover:text-foreground">
            Bảo mật
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            Điều khoản
          </Link>
        </nav>
      </div>
    </footer>
  );
}
