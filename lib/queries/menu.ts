import { db } from '@/lib/db';
import { menuItems, menuCategories, recipes, materials } from '@/lib/db/schema';
import { asc, desc, eq } from 'drizzle-orm';

export async function listMenuItems(categoryId?: number) {
  const rows = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      slug: menuItems.slug,
      photoUrl: menuItems.photoUrl,
      priceCents: menuItems.priceCents,
      cogsSnapshotCents: menuItems.cogsSnapshotCents,
      shelfLifeHours: menuItems.shelfLifeHours,
      active: menuItems.active,
      categoryId: menuItems.categoryId,
      categoryName: menuCategories.name,
    })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
    .where(categoryId ? eq(menuItems.categoryId, categoryId) : undefined)
    .orderBy(desc(menuItems.createdAt));
  return rows;
}

export async function listCategories() {
  return await db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder), asc(menuCategories.id));
}

export async function getMenuItemDetail(id: number) {
  const item = (await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1))[0];
  if (!item) return null;
  const cat = (
    await db.select().from(menuCategories).where(eq(menuCategories.id, item.categoryId)).limit(1)
  )[0];
  const recipeRows = await db
    .select({
      id: recipes.id,
      materialId: recipes.materialId,
      qtyUsed: recipes.qtyUsed,
      materialName: materials.name,
      unit: materials.unit,
      costPerUnitCents: materials.costPerUnitCents,
    })
    .from(recipes)
    .innerJoin(materials, eq(recipes.materialId, materials.id))
    .where(eq(recipes.menuItemId, id));
  return { item, category: cat, recipes: recipeRows };
}
