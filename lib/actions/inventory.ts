'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials, suppliers, materialMovements } from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import { materialSchema, supplierSchema, movementSchema } from '@/lib/validators';
import { mirrorToSheet } from '@/lib/integrations/sheets';

async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  return s;
}
async function requireOwner() {
  const s = await requireSession();
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function createMaterial(formData: FormData) {
  const s = await requireOwner();
  const parsed = materialSchema.parse({
    name: formData.get('name'),
    unit: formData.get('unit'),
    costPerUnitCents: formData.get('costPerUnitCents'),
    qtyOnHand: formData.get('qtyOnHand') ?? 0,
    lowStockThreshold: formData.get('lowStockThreshold') ?? 0,
    supplierId: formData.get('supplierId') || null,
    active: formData.get('active') !== 'off',
  });
  const [row] = await db
    .insert(materials)
    .values({
      name: parsed.name,
      unit: parsed.unit,
      costPerUnitCents: parsed.costPerUnitCents,
      qtyOnHand: String(parsed.qtyOnHand),
      lowStockThreshold: String(parsed.lowStockThreshold),
      supplierId: parsed.supplierId ?? null,
      active: parsed.active,
    })
    .returning();
  // opening balance movement
  if (Number(parsed.qtyOnHand) > 0) {
    await db.insert(materialMovements).values({
      materialId: row.id,
      deltaQty: String(parsed.qtyOnHand),
      reason: 'opening_balance',
      unitCostCents: parsed.costPerUnitCents,
      createdBy: Number(s.user.id),
    });
  }
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'Material', entityId: row.id, after: row });
  Promise.resolve(
    mirrorToSheet('material', 'create', row.id, { name: row.name, unit: row.unit, qty_on_hand: parsed.qtyOnHand }),
  ).catch(() => {});
  revalidatePath('/inventory');
  redirect(`/inventory/${row.id}`);
}

export async function recordMovement(formData: FormData) {
  const s = await requireSession();
  const parsed = movementSchema.parse({
    materialId: formData.get('materialId'),
    reason: formData.get('reason'),
    deltaQty: formData.get('deltaQty'),
    unitCostCents: formData.get('unitCostCents') || null,
    notes: formData.get('notes') || null,
  });
  // staff cannot do 'adjustment' (owner-only); but can do purchase/waste
  if (parsed.reason === 'adjustment' && s.user.role !== 'owner') throw new Error('FORBIDDEN');
  await db.insert(materialMovements).values({
    materialId: parsed.materialId,
    deltaQty: String(parsed.deltaQty),
    reason: parsed.reason,
    unitCostCents: parsed.unitCostCents ?? null,
    notes: parsed.notes ?? null,
    createdBy: Number(s.user.id),
  });
  await db
    .update(materials)
    .set({ qtyOnHand: sql`(${materials.qtyOnHand}::numeric + ${parsed.deltaQty})::numeric(12,3)` })
    .where(eq(materials.id, parsed.materialId));
  await logAudit({
    actorUserId: Number(s.user.id),
    action: 'update',
    entity: 'Material',
    entityId: parsed.materialId,
    after: { reason: parsed.reason, delta: parsed.deltaQty },
  });
  revalidatePath(`/inventory/${parsed.materialId}`);
  revalidatePath('/inventory');
}

export async function createSupplier(formData: FormData) {
  const s = await requireOwner();
  const parsed = supplierSchema.parse({
    name: formData.get('name'),
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    address: formData.get('address') || null,
    notes: formData.get('notes') || null,
  });
  const [row] = await db.insert(suppliers).values({
    name: parsed.name,
    phone: parsed.phone ?? null,
    email: parsed.email && parsed.email.length ? parsed.email : null,
    address: parsed.address ?? null,
    notes: parsed.notes ?? null,
  }).returning();
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'Supplier', entityId: row.id, after: row });
  revalidatePath('/inventory/suppliers');
  redirect(`/inventory/suppliers/${row.id}`);
}
