import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Cormorant_Garamond } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bevi',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  style: ['italic', 'normal'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ngọt — Patissiere & More',
  description: 'Quản lý cửa hàng bánh ngọt, đơn giản hơn bao giờ hết.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${beVietnam.variable} ${cormorant.variable}`}>
      <body className="font-sans min-h-screen flex flex-col bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
