'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, sql, desc, lt, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  customers,
  menuItems,
  campaigns,
  materialMovements,
  materials,
  telegramAlerts,
} from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import { sendTelegram } from '@/lib/integrations/telegram';
import { mirrorToSheet } from '@/lib/integrations/sheets';
import { orderCreateSchema } from '@/lib/validators';
import { orderCode } from '@/lib/utils';
import { nextOrderSeq } from '@/lib/queries/orders';
import { consumedMaterialsForOrder } from '@/lib/cogs';

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  return session;
}

export async function createOrder(input: unknown) {
  const session = await requireSession();
  const data = orderCreateSchema.parse(input);
  const userId = Number(session.user.id);

  // load menu item prices for snapshot
  const itemRows = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.active, true));
  const priceById = new Map(itemRows.map((r) => [r.id, r]));

  let subtotal = 0;
  const ois = data.items.map((it) => {
    const mi = priceById.get(it.menuItemId);
    if (!mi) throw new Error(`menu item ${it.menuItemId} not found or inactive`);
    const line = mi.priceCents * it.qty;
    subtotal += line;
    return {
      menuItemId: mi.id,
      qty: it.qty,
      unitPriceCents: mi.priceCents,
      lineTotalCents: line,
      itemNameSnapshot: mi.name,
    };
  });

  let discount = 0;
  if (data.campaignId) {
    const cmp = (await db.select().from(campaigns).where(eq(campaigns.id, data.campaignId)).limit(1))[0];
    if (cmp && cmp.active) {
      discount = cmp.type === 'percentage' ? Math.round((subtotal * cmp.value) / 100) : cmp.value;
      if (discount > subtotal) discount = subtotal;
    }
  }
  const taxable = subtotal - discount;
  const vatCents = Math.round((taxable * data.vatPct) / 100);
  const total = taxable + vatCents;

  const seq = await nextOrderSeq();
  const code = orderCode(seq);
  const deadlineAt = data.deadlineAt ? new Date(data.deadlineAt) : new Date(Date.now() + 2 * 60 * 60 * 1000);

  const [order] = await db
    .insert(orders)
    .values({
      code,
      customerId: data.customerId,
      status: 'new',
      subtotalCents: subtotal,
      discountCents: discount,
      campaignId: data.campaignId ?? null,
      vatPct: data.vatPct,
      vatCents,
      totalCents: total,
      deadlineAt,
      paymentMethod: data.paymentMethod ?? null,
      paymentStatus: 'unpaid',
      notes: data.notes ?? null,
      createdBy: userId,
    })
    .returning();

  await db.insert(orderItems).values(ois.map((o) => ({ ...o, orderId: order.id })));

  // mark consent on customer if not yet
  await db
    .update(customers)
    .set({ consentGivenAt: sql`coalesce(${customers.consentGivenAt}, now())` })
    .where(eq(customers.id, data.customerId));

  // bump campaign redemption
  if (data.campaignId) {
    await db
      .update(campaigns)
      .set({ redemptionCount: sql`${campaigns.redemptionCount} + 1` })
      .where(eq(campaigns.id, data.campaignId));
  }

  await logAudit({
    actorUserId: userId,
    action: 'create',
    entity: 'Order',
    entityId: order.id,
    after: { code, total },
  });

  // best-effort integrations (non-blocking)
  const cust = (await db.select().from(customers).where(eq(customers.id, data.customerId)).limit(1))[0];
  Promise.allSettled([
    sendTelegram('order_confirmed', {
      code,
      customer: cust?.name ?? 'Khách',
      total: total,
      deadline_at: deadlineAt.toISOString(),
    }),
    mirrorToSheet('order', 'create', order.id, {
      code,
      customer: cust?.name ?? '',
      status: 'new',
      total_cents: total,
      created_at: order.createdAt.toISOString(),
    }),
  ]).catch(() => {});

  revalidatePath('/orders');
  redirect(`/orders/${order.id}`);
}

const NEXT_STATUS: Record<string, string> = {
  new: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

export async function transitionOrder(id: number, target: string) {
  const session = await requireSession();
  const userId = Number(session.user.id);
  const cur = (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
  if (!cur) throw new Error('order not found');
  if (cur.status === 'canceled' || cur.status === 'delivered') {
    throw new Error('Order already terminal');
  }
  let nextStatus = target;
  if (target === 'next') {
    const n = NEXT_STATUS[cur.status];
    if (!n) throw new Error('no next status');
    nextStatus = n;
  }
  const validTargets = ['confirmed', 'preparing', 'ready', 'delivered', 'canceled'];
  if (!validTargets.includes(nextStatus)) throw new Error('invalid target status');

  const stamp: Record<string, Date> = { now: new Date() };
  const updates: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'confirmed') updates.confirmedAt = stamp.now;
  if (nextStatus === 'preparing') updates.preparingAt = stamp.now;
  if (nextStatus === 'ready') updates.readyAt = stamp.now;
  if (nextStatus === 'delivered') updates.deliveredAt = stamp.now;
  if (nextStatus === 'canceled') updates.canceledAt = stamp.now;

  await db.update(orders).set(updates).where(eq(orders.id, id));

  // Inventory consumption on entry to 'preparing'
  if (nextStatus === 'preparing' && cur.status !== 'preparing') {
    const consumed = await consumedMaterialsForOrder(id);
    for (const [matId, qty] of consumed.entries()) {
      if (qty <= 0) continue;
      await db.insert(materialMovements).values({
        materialId: matId,
        deltaQty: String(-qty),
        reason: 'consumption',
        orderId: id,
        createdBy: userId,
      });
      // denorm qty_on_hand
      await db
        .update(materials)
        .set({ qtyOnHand: sql`(${materials.qtyOnHand}::numeric - ${qty})::numeric(12,3)` })
        .where(eq(materials.id, matId));
      // low-stock debounce
      const m = (await db.select().from(materials).where(eq(materials.id, matId)).limit(1))[0];
      if (m && Number(m.lowStockThreshold) > 0 && Number(m.qtyOnHand) <= Number(m.lowStockThreshold)) {
        const lastAlert = await db
          .select({ sentAt: telegramAlerts.sentAt })
          .from(telegramAlerts)
          .where(eq(telegramAlerts.kind, 'low_inventory'))
          .orderBy(desc(telegramAlerts.sentAt))
          .limit(1);
        const last = lastAlert[0]?.sentAt;
        const hoursSince = last ? (Date.now() - new Date(last).getTime()) / 3_600_000 : 999;
        if (hoursSince > 24) {
          Promise.resolve(
            sendTelegram('low_inventory', {
              material_name: m.name,
              qty_on_hand: m.qtyOnHand,
              threshold: m.lowStockThreshold,
              unit: m.unit,
            }),
          ).catch(() => {});
        }
      }
    }
    await logAudit({
      actorUserId: userId,
      action: 'consume_materials',
      entity: 'Order',
      entityId: id,
      after: { consumed_materials: Array.from(consumed.entries()) },
    });
  }

  // Reverse consumption on cancel-after-preparing
  if (
    nextStatus === 'canceled' &&
    (cur.status === 'preparing' || cur.status === 'ready')
  ) {
    const consMoves = await db
      .select()
      .from(materialMovements)
      .where(and(eq(materialMovements.orderId, id), eq(materialMovements.reason, 'consumption')));
    for (const m of consMoves) {
      const reverseQty = -Number(m.deltaQty);
      await db.insert(materialMovements).values({
        materialId: m.materialId,
        deltaQty: String(reverseQty),
        reason: 'adjustment',
        orderId: id,
        createdBy: userId,
        notes: `Reversal of order ${cur.code} cancel`,
      });
      await db
        .update(materials)
        .set({ qtyOnHand: sql`(${materials.qtyOnHand}::numeric + ${Math.abs(reverseQty)})::numeric(12,3)` })
        .where(eq(materials.id, m.materialId));
    }
  }

  await logAudit({
    actorUserId: userId,
    action: 'transition_order',
    entity: 'Order',
    entityId: id,
    before: { status: cur.status },
    after: { status: nextStatus },
  });

  Promise.allSettled([
    sendTelegram('order_status_changed', {
      code: cur.code,
      old: cur.status,
      new: nextStatus,
    }),
    mirrorToSheet('order', 'update', id, {
      code: cur.code,
      status: nextStatus,
      total_cents: cur.totalCents,
    }),
  ]).catch(() => {});

  revalidatePath(`/orders/${id}`);
  revalidatePath('/orders');
  revalidatePath('/staff');
  revalidatePath('/admin');
}

export async function reconcilePayment(id: number, status: 'paid' | 'unpaid' | 'refunded') {
  const session = await requireSession();
  const userId = Number(session.user.id);
  await db
    .update(orders)
    .set({ paymentStatus: status, paymentReconciledAt: status === 'paid' ? new Date() : null })
    .where(eq(orders.id, id));
  await logAudit({ actorUserId: userId, action: 'update', entity: 'Order', entityId: id, after: { paymentStatus: status } });
  revalidatePath(`/orders/${id}`);
}
