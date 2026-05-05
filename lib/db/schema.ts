// Drizzle schema — single source of truth for Ngọt DB.
// Hand-authored from .appdroid/design.md §2.
// Money: integer "_cents" columns (đồng).
// Quantities: numeric(12,3) — Drizzle returns string; cast at read.

import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['owner', 'staff']);
export const unitEnum = pgEnum('unit', ['g', 'kg', 'ml', 'L', 'piece', 'box']);
export const movementReasonEnum = pgEnum('movement_reason', [
  'opening_balance',
  'purchase',
  'consumption',
  'waste',
  'adjustment',
]);
export const orderStatusEnum = pgEnum('order_status', [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
  'canceled',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'VietQR',
  'MoMo',
  'ZaloPay',
  'BankTransfer',
  'Cash',
  'COD',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid',
  'paid',
  'refunded',
]);
export const campaignTypeEnum = pgEnum('campaign_type', ['percentage', 'fixed']);
export const campaignAppliesToEnum = pgEnum('campaign_applies_to', [
  'all',
  'category',
  'item',
]);
export const expenseCategoryEnum = pgEnum('expense_category', [
  'rent',
  'utilities',
  'labor',
  'packaging',
  'marketing',
  'ingredients_other',
  'other',
]);
export const telegramKindEnum = pgEnum('telegram_kind', [
  'order_confirmed',
  'order_deadline_soon',
  'order_status_changed',
  'low_inventory',
  'manual_test',
]);
export const sheetEntityEnum = pgEnum('sheet_entity', [
  'order',
  'menu_item',
  'material',
  'customer',
  'expense',
]);
export const sheetActionEnum = pgEnum('sheet_action', ['create', 'update', 'delete']);
export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'signin',
  'signout',
  'failed_signin',
  'transition_order',
  'consume_materials',
  'export_dsr',
]);

// ── core ──────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    role: roleEnum('role').notNull(),
    phone: varchar('phone', { length: 32 }),
    locale: varchar('locale', { length: 16 }).notNull().default('vi-VN'),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: false }).$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: auditActionEnum('action').notNull(),
    entity: varchar('entity', { length: 64 }),
    entityId: integer('entity_id'),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_events_action_idx').on(t.action), index('audit_events_created_at_idx').on(t.createdAt)],
);

// ── inventory ─────────────────────────────────────────────────────────
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
});

export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  unit: unitEnum('unit').notNull(),
  costPerUnitCents: integer('cost_per_unit_cents').notNull(),
  qtyOnHand: numeric('qty_on_hand', { precision: 12, scale: 3 }).notNull().default('0'),
  lowStockThreshold: numeric('low_stock_threshold', { precision: 12, scale: 3 }).notNull().default('0'),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
});

export const materialMovements = pgTable(
  'material_movements',
  {
    id: serial('id').primaryKey(),
    materialId: integer('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    deltaQty: numeric('delta_qty', { precision: 12, scale: 3 }).notNull(),
    reason: movementReasonEnum('reason').notNull(),
    orderId: integer('order_id'),
    unitCostCents: integer('unit_cost_cents'),
    notes: text('notes'),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('material_movements_material_idx').on(t.materialId),
    index('material_movements_order_idx').on(t.orderId),
  ],
);

// ── menu ──────────────────────────────────────────────────────────────
export const menuCategories = pgTable('menu_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
});

export const menuItems = pgTable(
  'menu_items',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    description: text('description'),
    photoUrl: text('photo_url'),
    priceCents: integer('price_cents').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => menuCategories.id, { onDelete: 'restrict' }),
    cogsSnapshotCents: integer('cogs_snapshot_cents').notNull().default(0),
    shelfLifeHours: integer('shelf_life_hours'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('menu_items_slug_uq').on(t.slug)],
);

export const recipes = pgTable(
  'recipes',
  {
    id: serial('id').primaryKey(),
    menuItemId: integer('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    materialId: integer('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    qtyUsed: numeric('qty_used', { precision: 12, scale: 3 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
  },
  (t) => [index('recipes_menu_item_idx').on(t.menuItemId)],
);

// ── orders ────────────────────────────────────────────────────────────
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  address: text('address'),
  notes: text('notes'),
  consentGivenAt: timestamp('consent_given_at'),
  totalSpentCents: integer('total_spent_cents').notNull().default(0),
  orderCount: integer('order_count').notNull().default(0),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
});

export type TelegramAlertSent = { kind: string; sent_at: string };

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 32 }).notNull(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').notNull().default('new'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    campaignId: integer('campaign_id'),
    vatPct: integer('vat_pct').notNull().default(8),
    vatCents: integer('vat_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    deadlineAt: timestamp('deadline_at'),
    paymentMethod: paymentMethodEnum('payment_method'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
    paymentReconciledAt: timestamp('payment_reconciled_at'),
    notes: text('notes'),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at'),
    preparingAt: timestamp('preparing_at'),
    readyAt: timestamp('ready_at'),
    deliveredAt: timestamp('delivered_at'),
    canceledAt: timestamp('canceled_at'),
    telegramAlertsSent: jsonb('telegram_alerts_sent')
      .$type<TelegramAlertSent[]>()
      .notNull()
      .default([]),
  },
  (t) => [
    uniqueIndex('orders_code_uq').on(t.code),
    index('orders_status_idx').on(t.status),
    index('orders_customer_idx').on(t.customerId),
    index('orders_created_at_idx').on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: integer('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'restrict' }),
    qty: integer('qty').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    itemNameSnapshot: varchar('item_name_snapshot', { length: 200 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

// ── marketing ─────────────────────────────────────────────────────────
export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  type: campaignTypeEnum('type').notNull(),
  value: integer('value').notNull(),
  appliesTo: campaignAppliesToEnum('applies_to').notNull(),
  appliesToId: integer('applies_to_id'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  active: boolean('active').notNull().default(true),
  redemptionCount: integer('redemption_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
});

// ── finance ───────────────────────────────────────────────────────────
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  category: expenseCategoryEnum('category').notNull(),
  amountCents: integer('amount_cents').notNull(),
  description: text('description'),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── integrations ──────────────────────────────────────────────────────
export const telegramAlerts = pgTable(
  'telegram_alerts',
  {
    id: serial('id').primaryKey(),
    kind: telegramKindEnum('kind').notNull(),
    payloadJson: jsonb('payload_json').notNull().default({}),
    chatId: varchar('chat_id', { length: 64 }).notNull(),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
    succeeded: boolean('succeeded').notNull(),
    errorMsg: text('error_msg'),
  },
  (t) => [index('telegram_alerts_sent_at_idx').on(t.sentAt)],
);

export const sheetSyncLogs = pgTable('sheet_sync_logs', {
  id: serial('id').primaryKey(),
  entity: sheetEntityEnum('entity').notNull(),
  entityId: integer('entity_id').notNull(),
  action: sheetActionEnum('action').notNull(),
  sheetTab: varchar('sheet_tab', { length: 64 }).notNull(),
  rowIndex: integer('row_index'),
  succeeded: boolean('succeeded').notNull(),
  errorMsg: text('error_msg'),
  syncedAt: timestamp('synced_at').notNull().defaultNow(),
});

// ── Type exports ──────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type MaterialMovement = typeof materialMovements.$inferSelect;
export type NewMaterialMovement = typeof materialMovements.$inferInsert;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type NewMenuCategory = typeof menuCategories.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type TelegramAlert = typeof telegramAlerts.$inferSelect;
export type NewTelegramAlert = typeof telegramAlerts.$inferInsert;
export type SheetSyncLog = typeof sheetSyncLogs.$inferSelect;
export type NewSheetSyncLog = typeof sheetSyncLogs.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

export type Role = (typeof roleEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type Unit = (typeof unitEnum.enumValues)[number];
export type MovementReason = (typeof movementReasonEnum.enumValues)[number];
export type ExpenseCategory = (typeof expenseCategoryEnum.enumValues)[number];
export type CampaignType = (typeof campaignTypeEnum.enumValues)[number];
export type CampaignAppliesTo = (typeof campaignAppliesToEnum.enumValues)[number];
