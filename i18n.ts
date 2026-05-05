import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED = ['vi', 'en'] as const;
type Locale = (typeof SUPPORTED)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale = SUPPORTED.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : 'vi';
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
