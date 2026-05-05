import { db } from '@/lib/db';
import { orders, expenses } from '@/lib/db/schema';
import { and, desc, eq, gte, lte, sql, between } from 'drizzle-orm';
import { cogsForOrder } from '@/lib/cogs';

export async function pnlForPeriod(from: Date, to: Date) {
  const [revRow] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to), eq(orders.status, 'delivered')));
  const orderRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to), eq(orders.status, 'delivered')));
  let cogs = 0;
  for (const o of orderRows) {
    cogs += await cogsForOrder(o.id);
  }
  const expRows = await db
    .select({
      category: expenses.category,
      total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
    })
    .from(expenses)
    .where(between(expenses.date, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)))
    .groupBy(expenses.category);
  const totalExpenses = expRows.reduce((a, e) => a + e.total, 0);
  const revenue = revRow?.revenue ?? 0;
  const grossMargin = revenue - cogs;
  const cogsPct = revenue ? (cogs / revenue) * 100 : 0;
  return {
    revenue,
    cogs,
    cogsPct,
    grossMargin,
    expensesByCategory: expRows,
    totalExpenses,
    netProfit: grossMargin - totalExpenses,
    orderCount: revRow?.orderCount ?? 0,
  };
}

export async function listExpenses(category?: string) {
  return await db
    .select()
    .from(expenses)
    .where(category ? eq(expenses.category, category as 'rent') : undefined)
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(200);
}
