import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const t = await getTranslations('brand');
  const tAuth = await getTranslations('auth');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: 'Ngọt',
    description: t('tagline'),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'TP. Hồ Chí Minh',
      addressCountry: 'VN',
    },
    servesCuisine: ['Bakery', 'Pastry', 'Vietnamese'],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="bg-cream/40">
        <div className="container py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full bg-rose/20 px-3 py-1 text-xs font-medium text-cocoa">
              Pâtisserie management · Vietnam
            </div>
            <h1 className="font-display italic text-5xl lg:text-7xl text-cocoa text-balance leading-[1.05]">
              {t('app_name')}
            </h1>
            <p className="text-xs uppercase tracking-[0.4em] text-cocoa/60">PATISSIERE &amp; MORE</p>
            <p className="text-lg text-foreground/80 max-w-xl text-balance">{t('tagline')}</p>
            <div className="flex flex-wrap gap-3 pt-4">
              <Link href="/signin">
                <Button size="lg">{tAuth('signin.submit')}</Button>
              </Link>
              <Link href="/legal/privacy">
                <Button size="lg" variant="outline">
                  Bảo mật &amp; PDPL
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="rounded-3xl bg-rose p-10 lg:p-16 shadow-xl">
              <BrandLogo variant="both" size="lg" />
            </div>
          </div>
        </div>
      </section>

      <section className="container py-16 grid md:grid-cols-3 gap-8">
        {[
          { t: 'Đơn hàng & Kanban', d: 'Theo dõi đơn từ "mới" đến "đã giao" trên một bảng kéo thả; cảnh báo Telegram khi gần hạn.' },
          { t: 'Tồn kho & COGS', d: 'Mỗi đơn pha chế tự động trừ kho theo công thức; báo cáo COGS% theo tuần.' },
          { t: 'Tài chính & PDPL', d: 'P&L đa kỳ, chi phí phân loại, xuất/xóa dữ liệu theo Luật 91/2025.' },
        ].map((f, i) => (
          <div key={i} className="rounded-lg border bg-background p-6 hover:shadow-md transition-shadow">
            <h3 className="font-display text-2xl text-cocoa mb-2">{f.t}</h3>
            <p className="text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
