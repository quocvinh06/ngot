import { db } from '@/lib/db';
import { materials, suppliers, materialMovements, users } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export async function listMaterials(supplierId?: number) {
  return await db
    .select({
      id: materials.id,
      name: materials.name,
      unit: materials.unit,
      costPerUnitCents: materials.costPerUnitCents,
      qtyOnHand: materials.qtyOnHand,
      lowStockThreshold: materials.lowStockThreshold,
      supplierId: materials.supplierId,
      active: materials.active,
      supplierName: suppliers.name,
    })
    .from(materials)
    .leftJoin(suppliers, eq(materials.supplierId, suppliers.id))
    .where(supplierId ? eq(materials.supplierId, supplierId) : undefined)
    .orderBy(desc(materials.createdAt));
}

export async function listSuppliers() {
  return await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
}

export async function getMaterialDetail(id: number) {
  const mat = (await db.select().from(materials).where(eq(materials.id, id)).limit(1))[0];
  if (!mat) return null;
  const supplier = mat.supplierId
    ? (await db.select().from(suppliers).where(eq(suppliers.id, mat.supplierId)).limit(1))[0]
    : null;
  const moves = await db
    .select({
      id: materialMovements.id,
      deltaQty: materialMovements.deltaQty,
      reason: materialMovements.reason,
      orderId: materialMovements.orderId,
      unitCostCents: materialMovements.unitCostCents,
      notes: materialMovements.notes,
      createdAt: materialMovements.createdAt,
      createdByName: users.name,
    })
    .from(materialMovements)
    .leftJoin(users, eq(materialMovements.createdBy, users.id))
    .where(eq(materialMovements.materialId, id))
    .orderBy(desc(materialMovements.createdAt))
    .limit(50);
  return { material: mat, supplier, movements: moves };
}

export async function getSupplierDetail(id: number) {
  const sup = (await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1))[0];
  if (!sup) return null;
  const mats = await db
    .select({ id: materials.id, name: materials.name, qtyOnHand: materials.qtyOnHand, unit: materials.unit })
    .from(materials)
    .where(eq(materials.supplierId, id));
  return { supplier: sup, materials: mats };
}

export async function lowStockMaterials() {
  return await db
    .select({
      id: materials.id,
      name: materials.name,
      qtyOnHand: materials.qtyOnHand,
      lowStockThreshold: materials.lowStockThreshold,
      unit: materials.unit,
    })
    .from(materials)
    .where(sql`${materials.lowStockThreshold} > 0 AND ${materials.qtyOnHand}::numeric <= ${materials.lowStockThreshold}::numeric AND ${materials.active} = true`)
    .limit(10);
}
