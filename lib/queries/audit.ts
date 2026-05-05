import { db } from '@/lib/db';
import { auditEvents, telegramAlerts, sheetSyncLogs, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function listAudit() {
  return await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entity: auditEvents.entity,
      entityId: auditEvents.entityId,
      ipAddress: auditEvents.ipAddress,
      createdAt: auditEvents.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
}

export async function listTelegramAlerts() {
  return await db.select().from(telegramAlerts).orderBy(desc(telegramAlerts.sentAt)).limit(200);
}

export async function listSheetSync() {
  return await db.select().from(sheetSyncLogs).orderBy(desc(sheetSyncLogs.syncedAt)).limit(200);
}
