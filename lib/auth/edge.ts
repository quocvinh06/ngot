// Edge-safe NextAuth config: NO database / bcrypt imports here.
// Loaded by middleware.ts (which runs in the Edge runtime).
import type { NextAuthConfig } from 'next-auth';

export const authEdgeConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/signin',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: 'owner' | 'staff' }).role ?? 'staff';
        token.uid = (user as { id?: string }).id ?? token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = (token.uid as string) ?? token.sub ?? '';
        (session.user as { role?: 'owner' | 'staff' }).role =
          (token.role as 'owner' | 'staff') ?? 'staff';
      }
      return session;
    },
  },
  providers: [], // populated only in lib/auth/config.ts
};
