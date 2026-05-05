'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import { campaignSchema } from '@/lib/validators';

async function requireOwner() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function createCampaign(formData: FormData) {
  const s = await requireOwner();
  const parsed = campaignSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') || null,
    type: formData.get('type'),
    value: formData.get('value'),
    appliesTo: formData.get('appliesTo'),
    appliesToId: formData.get('appliesToId') || null,
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
    active: formData.get('active') !== 'off',
  });
  const [row] = await db
    .insert(campaigns)
    .values({
      name: parsed.name,
      description: parsed.description ?? null,
      type: parsed.type,
      value: parsed.value,
      appliesTo: parsed.appliesTo,
      appliesToId: parsed.appliesToId ?? null,
      startsAt: new Date(parsed.startsAt),
      endsAt: new Date(parsed.endsAt),
      active: parsed.active,
    })
    .returning();
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'Campaign', entityId: row.id, after: row });
  revalidatePath('/campaigns');
  redirect(`/campaigns/${row.id}`);
}

export async function updateCampaign(id: number, formData: FormData) {
  const s = await requireOwner();
  const parsed = campaignSchema.partial().parse({
    name: formData.get('name'),
    description: formData.get('description'),
    type: formData.get('type'),
    value: formData.get('value'),
    appliesTo: formData.get('appliesTo'),
    appliesToId: formData.get('appliesToId'),
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
    active: formData.get('active') !== 'off',
  });
  const before = (await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1))[0];
  await db
    .update(campaigns)
    .set({
      name: parsed.name ?? before?.name,
      description: parsed.description ?? before?.description,
      type: parsed.type ?? before?.type,
      value: parsed.value ?? before?.value,
      appliesTo: parsed.appliesTo ?? before?.appliesTo,
      appliesToId: parsed.appliesToId ?? before?.appliesToId,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : before?.startsAt,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : before?.endsAt,
      active: parsed.active ?? before?.active,
    })
    .where(eq(campaigns.id, id));
  await logAudit({ actorUserId: Number(s.user.id), action: 'update', entity: 'Campaign', entityId: id, before, after: parsed });
  revalidatePath(`/campaigns/${id}`);
  revalidatePath('/campaigns');
}
