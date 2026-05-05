import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

export async function listCampaigns() {
  return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

export async function getCampaign(id: number) {
  return (await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1))[0] ?? null;
}

export async function activeCampaigns(now: Date = new Date()) {
  return await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.active, true), lte(campaigns.startsAt, now), gte(campaigns.endsAt, now)));
}
