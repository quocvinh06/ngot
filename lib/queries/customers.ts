import { db } from '@/lib/db';
import { customers, orders } from '@/lib/db/schema';
import { desc, eq, ilike, isNull, or, sql, and } from 'drizzle-orm';

export async function listCustomers(search?: string, page: number = 1) {
  const limit = 30;
  const offset = (page - 1) * limit;
  const where = search
    ? and(
        isNull(customers.deletedAt),
        or(ilike(customers.name, `%${search}%`), ilike(customers.phone ?? sql`''`, `%${search}%`)),
      )
    : isNull(customers.deletedAt);
  return await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.updatedAt), desc(customers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getCustomerDetail(id: number) {
  const cust = (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0];
  if (!cust) return null;
  const recentOrders = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt))
    .limit(20);
  return { customer: cust, recentOrders };
}
