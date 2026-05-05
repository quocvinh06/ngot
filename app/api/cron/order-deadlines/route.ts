import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, customers } from '@/lib/db/schema';
import { and, gte, lte, eq, sql, inArray, notInArray } from 'drizzle-orm';
import { sendTelegram } from '@/lib/integrations/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 60 * 1000);

  // Find orders w/ deadline in next 30 min, not delivered/canceled, that have not had a 'order_deadline_soon' alert sent.
  const candidates = await db
    .select({
      id: orders.id,
      code: orders.code,
      deadlineAt: orders.deadlineAt,
      totalCents: orders.totalCents,
      status: orders.status,
      telegramAlertsSent: orders.telegramAlertsSent,
      customerId: orders.customerId,
    })
    .from(orders)
    .where(
      and(
        gte(orders.deadlineAt, now),
        lte(orders.deadlineAt, horizon),
        notInArray(orders.status, ['delivered', 'canceled']),
      ),
    )
    .limit(50);

  const due = candidates.filter(
    (o) => !(o.telegramAlertsSent ?? []).some((a) => a.kind === 'order_deadline_soon'),
  );

  let sent = 0;
  for (const o of due) {
    const cust = o.customerId
      ? (await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1))[0]
      : null;
    const result = await sendTelegram('order_deadline_soon', {
      code: o.code,
      customer: cust?.name ?? 'Khách',
      deadline_at: o.deadlineAt?.toISOString() ?? '',
      total_cents: o.totalCents,
    });
    if (result.ok) sent++;
    const updatedAlerts = [
      ...(o.telegramAlertsSent ?? []),
      { kind: 'order_deadline_soon', sent_at: new Date().toISOString() },
    ];
    await db
      .update(orders)
      .set({ telegramAlertsSent: updatedAlerts })
      .where(eq(orders.id, o.id));
  }

  // Touch sql to satisfy types.
  void sql;
  void inArray;

  return NextResponse.json({ ok: true, candidates: candidates.length, sent });
}
