'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, orders, orderItems } from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import { customerSchema, customerUpdateSchema } from '@/lib/validators';
import { mirrorToSheet } from '@/lib/integrations/sheets';

async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  return s;
}

async function requireOwner() {
  const s = await requireSession();
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function createCustomer(formData: FormData) {
  const s = await requireSession();
  const data = customerSchema.parse({
    name: formData.get('name'),
    phone: formData.get('phone') || null,
    address: formData.get('address') || null,
    notes: formData.get('notes') || null,
    consent: formData.get('consent') === 'on' || formData.get('consent') === 'true',
  });
  const [row] = await db
    .insert(customers)
    .values({
      name: data.name,
      phone: data.phone ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
      consentGivenAt: new Date(),
    })
    .returning();
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'Customer', entityId: row.id, after: row });
  Promise.resolve(
    mirrorToSheet('customer', 'create', row.id, {
      name: row.name,
      phone: row.phone ?? '',
      address: row.address ?? '',
    }),
  ).catch(() => {});
  revalidatePath('/customers');
  redirect(`/customers/${row.id}`);
}

export async function updateCustomer(id: number, formData: FormData) {
  const s = await requireSession();
  const data = customerUpdateSchema.parse({
    name: formData.get('name'),
    phone: formData.get('phone') || null,
    address: formData.get('address') || null,
    notes: formData.get('notes') || null,
    consent: formData.get('consent') ? formData.get('consent') === 'on' || formData.get('consent') === 'true' : undefined,
  });
  const before = (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0];
  if (!before) throw new Error('not found');
  await db
    .update(customers)
    .set({
      name: data.name ?? before.name,
      phone: data.phone ?? before.phone,
      address: data.address ?? before.address,
      notes: data.notes ?? before.notes,
    })
    .where(eq(customers.id, id));
  await logAudit({ actorUserId: Number(s.user.id), action: 'update', entity: 'Customer', entityId: id, before, after: data });
  Promise.resolve(
    mirrorToSheet('customer', 'update', id, { name: data.name ?? before.name, phone: data.phone ?? before.phone ?? '' }),
  ).catch(() => {});
  revalidatePath(`/customers/${id}`);
}

export async function anonymizeCustomer(id: number) {
  const s = await requireOwner();
  const before = (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0];
  if (!before) throw new Error('not found');
  await db
    .update(customers)
    .set({
      name: `KH ẩn danh #${id}`,
      phone: null,
      address: null,
      notes: null,
      deletedAt: new Date(),
    })
    .where(eq(customers.id, id));
  await logAudit({
    actorUserId: Number(s.user.id),
    action: 'delete',
    entity: 'Customer',
    entityId: id,
    before,
    after: { anonymized: true },
  });
  Promise.resolve(
    mirrorToSheet('customer', 'update', id, { name: `KH ẩn danh #${id}`, phone: '', address: '' }),
  ).catch(() => {});
  revalidatePath(`/customers/${id}`);
  revalidatePath('/customers');
}

export async function exportCustomerDsr(id: number) {
  const s = await requireOwner();
  const cust = (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0];
  if (!cust) return { ok: false };
  const ords = await db.select().from(orders).where(eq(orders.customerId, id));
  const ordIds = ords.map((o) => o.id);
  const items = ordIds.length ? await db.select().from(orderItems).where(eq(orderItems.orderId, ordIds[0])) : [];
  await logAudit({ actorUserId: Number(s.user.id), action: 'export_dsr', entity: 'Customer', entityId: id });
  return { ok: true, customer: cust, orders: ords, items };
}
