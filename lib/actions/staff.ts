'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const newStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(72),
  role: z.enum(['owner', 'staff']).default('staff'),
});

async function requireOwner() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function createStaffUser(formData: FormData) {
  const s = await requireOwner();
  const parsed = newStaffSchema.parse({
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
    role: formData.get('role') ?? 'staff',
  });
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const [row] = await db
    .insert(users)
    .values({
      email: parsed.email,
      name: parsed.name,
      passwordHash,
      role: parsed.role,
    })
    .returning();
  await logAudit({
    actorUserId: Number(s.user.id),
    action: 'create',
    entity: 'User',
    entityId: row.id,
    after: { email: row.email, role: row.role },
  });
  revalidatePath('/settings/staff');
}
