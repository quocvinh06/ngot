'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import { expenseSchema } from '@/lib/validators';
import { mirrorToSheet } from '@/lib/integrations/sheets';

async function requireOwner() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function createExpense(formData: FormData) {
  const s = await requireOwner();
  const parsed = expenseSchema.parse({
    date: formData.get('date'),
    category: formData.get('category'),
    amountCents: formData.get('amountCents'),
    description: formData.get('description') || null,
  });
  const [row] = await db
    .insert(expenses)
    .values({
      date: parsed.date,
      category: parsed.category,
      amountCents: parsed.amountCents,
      description: parsed.description ?? null,
      createdBy: Number(s.user.id),
    })
    .returning();
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'Expense', entityId: row.id, after: row });
  Promise.resolve(
    mirrorToSheet('expense', 'create', row.id, {
      date: row.date,
      category: row.category,
      amount_cents: row.amountCents,
    }),
  ).catch(() => {});
  revalidatePath('/finance/expenses');
  redirect('/finance/expenses');
}
