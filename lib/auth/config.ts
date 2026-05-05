// Full NextAuth config including DB-bound credentials provider.
// Loaded only by Node-runtime entry points (auth.ts, /api/auth/[...nextauth]).
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, auditEvents } from '@/lib/db/schema';
import { authEdgeConfig } from './edge';
import type { NextAuthConfig } from 'next-auth';

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  ...authEdgeConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = rows[0];
        if (!user) {
          await db.insert(auditEvents).values({
            action: 'failed_signin',
            entity: 'User',
            beforeJson: { email },
          }).catch(() => {});
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await db.insert(auditEvents).values({
            action: 'failed_signin',
            actorUserId: user.id,
            entity: 'User',
            entityId: user.id,
          }).catch(() => {});
          return null;
        }
        await db.insert(auditEvents).values({
          action: 'signin',
          actorUserId: user.id,
          entity: 'User',
          entityId: user.id,
        }).catch(() => {});
        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
};
