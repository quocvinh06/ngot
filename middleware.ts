import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authEdgeConfig } from '@/lib/auth/edge';

const { auth } = NextAuth(authEdgeConfig);

const ownerOnlyPrefixes = ['/finance', '/campaigns', '/settings', '/admin'];
const authedPrefixes = ['/admin', '/staff', '/orders', '/menu', '/inventory', '/customers', '/campaigns', '/finance', '/settings'];
const publicPaths = ['/', '/signin', '/legal/privacy', '/legal/terms'];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isPublic = publicPaths.includes(path) || path.startsWith('/api/auth') || path.startsWith('/_next') || path.startsWith('/favicon');
  if (isPublic) return NextResponse.next();

  const session = req.auth;
  const isAuthed = !!session?.user;
  const role = (session?.user as { role?: 'owner' | 'staff' } | undefined)?.role;

  // signin redirect when authed
  if (path === '/signin' && isAuthed) {
    const home = role === 'owner' ? '/admin' : '/staff';
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  if (!isAuthed && authedPrefixes.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = new URL('/signin', nextUrl);
    url.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && ownerOnlyPrefixes.some((p) => path === p || path.startsWith(p + '/')) && role !== 'owner') {
    return NextResponse.redirect(new URL('/staff', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)'],
};
