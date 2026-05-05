import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppNav } from '@/components/app-nav';
import { AppSidebar } from '@/components/app-sidebar';
import { AppFooter } from '@/components/app-footer';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const role = session.user.role;
  return (
    <>
      <AppNav />
      <div className="flex flex-1">
        <AppSidebar role={role} />
        <main className="flex-1 min-w-0">
          <div className="container py-6">{children}</div>
        </main>
      </div>
      <AppFooter />
    </>
  );
}
