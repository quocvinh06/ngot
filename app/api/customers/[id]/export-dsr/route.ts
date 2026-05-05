import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { customers, orders, orderItems } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }
  const cust = (await db.select().from(customers).where(eq(customers.id, customerId)).limit(1))[0];
  if (!cust) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const ords = await db.select().from(orders).where(eq(orders.customerId, customerId));
  const orderIds = ords.map((o) => o.id);
  const items = orderIds.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];

  await logAudit({
    actorUserId: Number(session.user.id),
    action: 'export_dsr',
    entity: 'Customer',
    entityId: customerId,
  });

  const filename = `customer-${customerId}-dsr-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(
    JSON.stringify({ customer: cust, orders: ords, orderItems: items }, null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    },
  );
}
