import { db } from '@/lib/db';
import { orders, orderItems, customers, menuItems, campaigns } from '@/lib/db/schema';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

export type OrderListFilters = {
  status?: string;
  customerId?: number;
  paymentStatus?: string;
  from?: Date;
  to?: Date;
  page?: number;
};

export async function listOrders(filters: OrderListFilters = {}) {
  const where: SQL[] = [];
  if (filters.status) where.push(eq(orders.status, filters.status as 'new'));
  if (filters.customerId) where.push(eq(orders.customerId, filters.customerId));
  if (filters.paymentStatus) where.push(eq(orders.paymentStatus, filters.paymentStatus as 'unpaid'));
  if (filters.from) where.push(gte(orders.createdAt, filters.from));
  if (filters.to) where.push(lte(orders.createdAt, filters.to));
  const limit = 30;
  const offset = ((filters.page ?? 1) - 1) * limit;
  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      paymentStatus: orders.paymentStatus,
      deadlineAt: orders.deadlineAt,
      createdAt: orders.createdAt,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function getOrderDetail(id: number) {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  const order = orderRows[0];
  if (!order) return null;
  const items = await db
    .select({
      id: orderItems.id,
      menuItemId: orderItems.menuItemId,
      qty: orderItems.qty,
      unitPriceCents: orderItems.unitPriceCents,
      lineTotalCents: orderItems.lineTotalCents,
      itemNameSnapshot: orderItems.itemNameSnapshot,
      photoUrl: menuItems.photoUrl,
      slug: menuItems.slug,
    })
    .from(orderItems)
    .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(eq(orderItems.orderId, id));
  const customer = (
    await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
  )[0];
  let campaign = null;
  if (order.campaignId) {
    campaign = (
      await db.select().from(campaigns).where(eq(campaigns.id, order.campaignId)).limit(1)
    )[0];
  }
  return { order, items, customer, campaign };
}

export async function nextOrderSeq(date: Date = new Date()): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)));
  return (r[0]?.c ?? 0) + 1;
}

export async function dashboardSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [revRow] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, today), eq(orders.status, 'delivered')));
  const statusRows = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(gte(orders.createdAt, today))
    .groupBy(orders.status);
  return {
    todayRevenue: revRow?.revenue ?? 0,
    todayCount: revRow?.count ?? 0,
    byStatus: statusRows,
  };
}
