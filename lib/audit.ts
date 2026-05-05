import { db } from '@/lib/db';
import { auditEvents } from '@/lib/db/schema';

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'signin' | 'signout' | 'failed_signin'
  | 'transition_order' | 'consume_materials' | 'export_dsr';

export async function logAudit(args: {
  actorUserId?: number | null;
  action: AuditAction;
  entity?: string | null;
  entityId?: number | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      actorUserId: args.actorUserId ?? null,
      action: args.action,
      entity: args.entity ?? null,
      entityId: args.entityId ?? null,
      beforeJson: (args.before ?? null) as never,
      afterJson: (args.after ?? null) as never,
      ipAddress: args.ipAddress ?? null,
    });
  } catch (err) {
    console.error('audit-log: failed to persist', err);
  }
}
