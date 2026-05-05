import { AppFooter } from '@/components/app-footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex-1">{children}</main>
      <AppFooter />
    </>
  );
}
