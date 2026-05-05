'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { menuItems, recipes, menuCategories } from '@/lib/db/schema';
import { auth } from '@/auth';
import { logAudit } from '@/lib/audit';
import { menuItemSchema, menuCategorySchema, recipeRowSchema } from '@/lib/validators';
import { recomputeMenuItemCogs } from '@/lib/cogs';
import { slugify } from '@/lib/utils';
import { mirrorToSheet } from '@/lib/integrations/sheets';
import { z } from 'zod';

async function requireOwner() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function createMenuItem(formData: FormData) {
  const s = await requireOwner();
  const parsed = menuItemSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug') || undefined,
    description: formData.get('description') || null,
    photoUrl: formData.get('photoUrl') || null,
    priceCents: formData.get('priceCents'),
    categoryId: formData.get('categoryId'),
    shelfLifeHours: formData.get('shelfLifeHours') || null,
    active: formData.get('active') !== 'off',
  });
  const slug = parsed.slug && parsed.slug.length > 0 ? parsed.slug : slugify(parsed.name);
  const [row] = await db
    .insert(menuItems)
    .values({
      name: parsed.name,
      slug,
      description: parsed.description ?? null,
      photoUrl: parsed.photoUrl || null,
      priceCents: parsed.priceCents,
      categoryId: parsed.categoryId,
      shelfLifeHours: parsed.shelfLifeHours ?? null,
      active: parsed.active,
    })
    .returning();
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'MenuItem', entityId: row.id, after: row });
  Promise.resolve(
    mirrorToSheet('menu_item', 'create', row.id, {
      name: row.name,
      slug: row.slug,
      price_cents: row.priceCents,
    }),
  ).catch(() => {});
  revalidatePath('/menu');
  redirect(`/menu/${row.id}`);
}

export async function updateMenuItem(id: number, formData: FormData) {
  const s = await requireOwner();
  const parsed = menuItemSchema.partial().parse({
    name: formData.get('name'),
    description: formData.get('description'),
    photoUrl: formData.get('photoUrl'),
    priceCents: formData.get('priceCents'),
    categoryId: formData.get('categoryId'),
    shelfLifeHours: formData.get('shelfLifeHours'),
    active: formData.get('active') !== 'off',
  });
  const before = (await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1))[0];
  await db
    .update(menuItems)
    .set({
      name: parsed.name ?? before?.name,
      description: parsed.description ?? before?.description,
      photoUrl: parsed.photoUrl ?? before?.photoUrl,
      priceCents: parsed.priceCents ?? before?.priceCents,
      categoryId: parsed.categoryId ?? before?.categoryId,
      shelfLifeHours: parsed.shelfLifeHours ?? before?.shelfLifeHours,
      active: parsed.active ?? before?.active,
    })
    .where(eq(menuItems.id, id));
  await logAudit({ actorUserId: Number(s.user.id), action: 'update', entity: 'MenuItem', entityId: id, before, after: parsed });
  revalidatePath(`/menu/${id}`);
  revalidatePath('/menu');
}

const recipeBatchSchema = z.object({ rows: z.array(recipeRowSchema) });

export async function saveRecipe(menuItemId: number, rows: { materialId: number; qtyUsed: number }[]) {
  const s = await requireOwner();
  recipeBatchSchema.parse({ rows });
  await db.delete(recipes).where(eq(recipes.menuItemId, menuItemId));
  if (rows.length > 0) {
    await db.insert(recipes).values(
      rows.map((r) => ({
        menuItemId,
        materialId: r.materialId,
        qtyUsed: String(r.qtyUsed),
      })),
    );
  }
  const newCogs = await recomputeMenuItemCogs(menuItemId);
  await logAudit({
    actorUserId: Number(s.user.id),
    action: 'update',
    entity: 'MenuItem.recipe',
    entityId: menuItemId,
    after: { recipeRows: rows.length, cogs: newCogs },
  });
  revalidatePath(`/menu/${menuItemId}`);
  return { cogs: newCogs };
}

export async function createCategory(formData: FormData) {
  const s = await requireOwner();
  const parsed = menuCategorySchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug') || undefined,
    sortOrder: formData.get('sortOrder') || 0,
    active: formData.get('active') !== 'off',
  });
  const slug = parsed.slug && parsed.slug.length ? parsed.slug : slugify(parsed.name);
  const [row] = await db
    .insert(menuCategories)
    .values({ name: parsed.name, slug, sortOrder: parsed.sortOrder, active: parsed.active })
    .returning();
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'MenuCategory', entityId: row.id, after: row });
  revalidatePath('/menu/categories');
  revalidatePath('/menu');
}
