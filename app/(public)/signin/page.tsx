import { Suspense } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { SigninForm } from './signin-form';

export const metadata = { title: 'Đăng nhập — Ngọt' };

export default function SigninPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      <aside className="hidden lg:flex bg-rose flex-col items-center justify-center p-10 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-rose to-blush opacity-90" aria-hidden />
        <div className="relative z-10 max-w-md text-center">
          <BrandLogo variant="both" size="lg" className="mx-auto" />
          <p className="mt-8 text-cream/95 text-lg italic font-display">
            Một góc nhỏ ngọt ngào, quản lý nhẹ nhàng — cho tiệm bánh của bạn.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Suspense fallback={null}>
            <SigninForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
