import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes, materials, menuItems, orderItems } from '@/lib/db/schema';

/** Recompute MenuItem.cogs_snapshot_cents from current recipes + material costs. */
export async function recomputeMenuItemCogs(menuItemId: number): Promise<number> {
  const recipeRows = await db
    .select({
      qty: recipes.qtyUsed,
      cost: materials.costPerUnitCents,
    })
    .from(recipes)
    .innerJoin(materials, eq(recipes.materialId, materials.id))
    .where(eq(recipes.menuItemId, menuItemId));
  let totalCents = 0;
  for (const r of recipeRows) {
    totalCents += Math.round(Number(r.qty) * r.cost);
  }
  await db.update(menuItems).set({ cogsSnapshotCents: totalCents }).where(eq(menuItems.id, menuItemId));
  return totalCents;
}

/** Sum cogs for an order across all OrderItems by their menu_item snapshots. */
export async function cogsForOrder(orderId: number): Promise<number> {
  const items = await db
    .select({ qty: orderItems.qty, miId: orderItems.menuItemId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  if (items.length === 0) return 0;
  const ids = items.map((i) => i.miId);
  const mis = await db
    .select({ id: menuItems.id, cogs: menuItems.cogsSnapshotCents })
    .from(menuItems)
    .where(inArray(menuItems.id, ids));
  const cogsMap = new Map(mis.map((m) => [m.id, m.cogs]));
  let total = 0;
  for (const i of items) total += i.qty * (cogsMap.get(i.miId) ?? 0);
  return total;
}

/** Aggregate consumed materials per recipe × order item qty. */
export async function consumedMaterialsForOrder(orderId: number): Promise<Map<number, number>> {
  const items = await db
    .select({ qty: orderItems.qty, miId: orderItems.menuItemId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  if (items.length === 0) return new Map();
  const ids = items.map((i) => i.miId);
  const recs = await db
    .select({ menuItemId: recipes.menuItemId, materialId: recipes.materialId, qty: recipes.qtyUsed })
    .from(recipes)
    .where(inArray(recipes.menuItemId, ids));
  const out = new Map<number, number>();
  for (const it of items) {
    for (const r of recs.filter((x) => x.menuItemId === it.miId)) {
      const total = Number(r.qty) * it.qty;
      out.set(r.materialId, (out.get(r.materialId) ?? 0) + total);
    }
  }
  return out;
}
