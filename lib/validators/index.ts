import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(32).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  consent: z.boolean().refine((v) => v === true, {
    message: 'PDPL consent required',
  }),
});

export const customerUpdateSchema = customerSchema.partial({ consent: true });

export const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(32).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const materialSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.enum(['g', 'kg', 'ml', 'L', 'piece', 'box']),
  costPerUnitCents: z.coerce.number().int().nonnegative(),
  qtyOnHand: z.coerce.number().nonnegative().default(0),
  lowStockThreshold: z.coerce.number().nonnegative().default(0),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  active: z.boolean().default(true),
});

export const menuCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).optional(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export const menuItemSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  photoUrl: z.string().url().max(1000).optional().nullable().or(z.literal('')),
  priceCents: z.coerce.number().int().nonnegative(),
  categoryId: z.coerce.number().int().positive(),
  shelfLifeHours: z.coerce.number().int().positive().optional().nullable(),
  active: z.boolean().default(true),
});

export const recipeRowSchema = z.object({
  materialId: z.coerce.number().int().positive(),
  qtyUsed: z.coerce.number().positive(),
});

export const orderItemSchema = z.object({
  menuItemId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().positive().max(999),
});

export const orderCreateSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  items: z.array(orderItemSchema).min(1),
  campaignId: z.coerce.number().int().positive().optional().nullable(),
  paymentMethod: z.enum(['VietQR', 'MoMo', 'ZaloPay', 'BankTransfer', 'Cash', 'COD']).optional().nullable(),
  vatPct: z.coerce.number().int().min(0).max(20).default(8),
  deadlineAt: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().int().nonnegative(),
  appliesTo: z.enum(['all', 'category', 'item']),
  appliesToId: z.coerce.number().int().positive().optional().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  active: z.boolean().default(true),
});

export const expenseSchema = z.object({
  date: z.string(),
  category: z.enum(['rent', 'utilities', 'labor', 'packaging', 'marketing', 'ingredients_other', 'other']),
  amountCents: z.coerce.number().int().nonnegative(),
  description: z.string().max(1000).optional().nullable(),
});

export const movementSchema = z.object({
  materialId: z.coerce.number().int().positive(),
  reason: z.enum(['purchase', 'waste', 'adjustment']),
  deltaQty: z.coerce.number(),
  unitCostCents: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
