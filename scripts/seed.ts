// scripts/seed.ts — idempotent Vietnamese pastry shop seed
// Magnitude floors per .claude/rules/synthesis-data.md FOMO mode.
// Re-runnable: bails if owner@ngot.local exists.

import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, pool } from '../lib/db';
import {
  users,
  suppliers,
  materials,
  materialMovements,
  menuCategories,
  menuItems,
  recipes,
  customers,
  orders,
  orderItems,
  campaigns,
  expenses,
  telegramAlerts,
  sheetSyncLogs,
  auditEvents,
} from '../lib/db/schema';

// Tiny deterministic PRNG so seed is reproducible
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260505);
const ri = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const choice = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;

async function main() {
  console.log('seed: starting…');

  // Whitelisted owners (real accounts) — passwords from env, default 'ngot1234'.
  // Change immediately after first sign-in via /settings/staff.
  const OWNER1_EMAIL = 'taquocvinhbk10@gmail.com';
  const OWNER2_EMAIL = 'hnlanh2910@gmail.com';
  const STAFF_EMAIL = 'staff@ngot.local';

  const existing = await db.select().from(users).where(eq(users.email, OWNER1_EMAIL)).limit(1);
  if (existing.length > 0) {
    console.log('seed: owner already exists — skipping.');
    await pool.end();
    return;
  }

  // ── Users (3) ──────────────────────────────────────────────────
  const owner1Pw = process.env.OWNER1_PASSWORD ?? 'ngot1234';
  const owner2Pw = process.env.OWNER2_PASSWORD ?? 'ngot1234';
  const staffPw = process.env.STAFF_PASSWORD ?? 'ngot1234';
  const owner1Hash = await bcrypt.hash(owner1Pw, 10);
  const owner2Hash = await bcrypt.hash(owner2Pw, 10);
  const staffHash = await bcrypt.hash(staffPw, 10);
  const insertedUsers = await db
    .insert(users)
    .values([
      { email: OWNER1_EMAIL, passwordHash: owner1Hash, name: 'Tạ Quốc Vinh', role: 'owner', phone: '+84901111111' },
      { email: OWNER2_EMAIL, passwordHash: owner2Hash, name: 'Lan Anh', role: 'owner', phone: '+84902222222' },
      { email: STAFF_EMAIL, passwordHash: staffHash, name: 'Nhân viên', role: 'staff', phone: '+84903333333' },
    ])
    .returning();
  const owner = insertedUsers[0]!;
  const staff1 = insertedUsers[1]!;  // (second owner — used as a created_by for variety)
  const staff2 = insertedUsers[2]!;  // (the actual staff)
  const allUsers = insertedUsers;

  // ── Suppliers (8) ──────────────────────────────────────────────
  const insertedSuppliers = await db
    .insert(suppliers)
    .values([
      { name: 'Bột Bình Đông', phone: '+84283823xxxx', address: 'Bình Đông, Q.8, TP.HCM' },
      { name: 'Sữa Vinamilk HCM', phone: '+842854345xxxx', address: '10 Tân Trào, Q.7, TP.HCM' },
      { name: 'Trứng gà Ba Huân', phone: '+842836362xxxx', address: 'Vĩnh Lộc A, Bình Chánh, TP.HCM' },
      { name: 'Bơ Anchor Việt Nam', phone: '+842839101xxxx', email: 'info@anchor.vn' },
      { name: 'Đường Biên Hòa', phone: '+842513823xxxx', address: 'KCN Biên Hòa 1, Đồng Nai' },
      { name: 'Trái cây Long Khánh', phone: '+842513724xxxx', address: 'Long Khánh, Đồng Nai' },
      { name: 'Bao bì Tân Á', phone: '+842838765xxxx', address: 'Q.Tân Bình, TP.HCM' },
      { name: 'Hương liệu Việt Hương', phone: '+842839438xxxx', address: 'Q.Tân Phú, TP.HCM' },
    ])
    .returning();

  // ── Materials (60) ─────────────────────────────────────────────
  const matSeed: Array<{ name: string; unit: 'g' | 'kg' | 'ml' | 'L' | 'piece' | 'box'; cost: number; lowStock: number }> = [
    { name: 'Bột mì số 13', unit: 'kg', cost: 25000, lowStock: 5 },
    { name: 'Bột mì số 8', unit: 'kg', cost: 23000, lowStock: 5 },
    { name: 'Bột bánh ngọt cao cấp', unit: 'kg', cost: 32000, lowStock: 4 },
    { name: 'Bột bắp', unit: 'kg', cost: 28000, lowStock: 2 },
    { name: 'Bột hạnh nhân', unit: 'kg', cost: 380000, lowStock: 1 },
    { name: 'Đường trắng tinh luyện', unit: 'kg', cost: 22000, lowStock: 8 },
    { name: 'Đường nâu', unit: 'kg', cost: 38000, lowStock: 3 },
    { name: 'Đường bột', unit: 'kg', cost: 45000, lowStock: 2 },
    { name: 'Bơ Anchor lạt', unit: 'kg', cost: 350000, lowStock: 2 },
    { name: 'Bơ Pháp Président', unit: 'kg', cost: 480000, lowStock: 1 },
    { name: 'Bơ thực vật', unit: 'kg', cost: 65000, lowStock: 2 },
    { name: 'Sữa tươi không đường Vinamilk', unit: 'L', cost: 32000, lowStock: 6 },
    { name: 'Sữa đặc Ngôi Sao Phương Nam', unit: 'box', cost: 25000, lowStock: 4 },
    { name: 'Sữa bột nguyên kem', unit: 'kg', cost: 220000, lowStock: 1 },
    { name: 'Trứng gà công nghiệp', unit: 'piece', cost: 4000, lowStock: 60 },
    { name: 'Trứng gà ta', unit: 'piece', cost: 6000, lowStock: 30 },
    { name: 'Lòng đỏ trứng (đóng gói)', unit: 'L', cost: 180000, lowStock: 1 },
    { name: 'Men nở khô', unit: 'g', cost: 200, lowStock: 200 },
    { name: 'Bột nổi (baking powder)', unit: 'g', cost: 120, lowStock: 200 },
    { name: 'Baking soda', unit: 'g', cost: 80, lowStock: 200 },
    { name: 'Tinh chất vani', unit: 'ml', cost: 600, lowStock: 100 },
    { name: 'Tinh chất hạnh nhân', unit: 'ml', cost: 800, lowStock: 50 },
    { name: 'Tinh chất chanh', unit: 'ml', cost: 700, lowStock: 50 },
    { name: 'Bột cacao Hà Lan', unit: 'kg', cost: 280000, lowStock: 1 },
    { name: 'Sô cô la đen 70%', unit: 'kg', cost: 420000, lowStock: 1 },
    { name: 'Sô cô la sữa', unit: 'kg', cost: 350000, lowStock: 1 },
    { name: 'Sô cô la trắng', unit: 'kg', cost: 380000, lowStock: 1 },
    { name: 'Whipping cream Anchor', unit: 'L', cost: 130000, lowStock: 3 },
    { name: 'Cream cheese Philadelphia', unit: 'kg', cost: 210000, lowStock: 2 },
    { name: 'Mascarpone', unit: 'kg', cost: 320000, lowStock: 1 },
    { name: 'Phô mai Mozzarella', unit: 'kg', cost: 280000, lowStock: 1 },
    { name: 'Mật ong rừng', unit: 'L', cost: 320000, lowStock: 1 },
    { name: 'Si rô đường', unit: 'L', cost: 60000, lowStock: 2 },
    { name: 'Muối biển', unit: 'kg', cost: 18000, lowStock: 2 },
    { name: 'Tinh dầu cam', unit: 'ml', cost: 1200, lowStock: 30 },
    { name: 'Tinh dầu chanh', unit: 'ml', cost: 1100, lowStock: 30 },
    { name: 'Phẩm màu thực phẩm đỏ', unit: 'ml', cost: 600, lowStock: 30 },
    { name: 'Phẩm màu thực phẩm vàng', unit: 'ml', cost: 600, lowStock: 30 },
    { name: 'Phẩm màu thực phẩm xanh lá', unit: 'ml', cost: 600, lowStock: 30 },
    { name: 'Phẩm màu thực phẩm tím', unit: 'ml', cost: 600, lowStock: 30 },
    { name: 'Hạt óc chó', unit: 'kg', cost: 480000, lowStock: 1 },
    { name: 'Hạnh nhân lát', unit: 'kg', cost: 520000, lowStock: 1 },
    { name: 'Hạnh nhân nguyên hạt', unit: 'kg', cost: 550000, lowStock: 1 },
    { name: 'Hạt điều rang', unit: 'kg', cost: 380000, lowStock: 1 },
    { name: 'Hạt mắc ca', unit: 'kg', cost: 720000, lowStock: 1 },
    { name: 'Mạch nha', unit: 'kg', cost: 80000, lowStock: 2 },
    { name: 'Đậu xanh đãi vỏ', unit: 'kg', cost: 45000, lowStock: 3 },
    { name: 'Đậu đỏ', unit: 'kg', cost: 55000, lowStock: 2 },
    { name: 'Mè trắng', unit: 'kg', cost: 80000, lowStock: 2 },
    { name: 'Mè đen', unit: 'kg', cost: 90000, lowStock: 2 },
    { name: 'Trà xanh matcha', unit: 'kg', cost: 1200000, lowStock: 1 },
    { name: 'Cà phê espresso', unit: 'kg', cost: 350000, lowStock: 1 },
    { name: 'Dâu tây tươi', unit: 'kg', cost: 280000, lowStock: 2 },
    { name: 'Việt quất tươi', unit: 'kg', cost: 450000, lowStock: 1 },
    { name: 'Mứt dâu', unit: 'kg', cost: 150000, lowStock: 1 },
    { name: 'Mứt cam', unit: 'kg', cost: 140000, lowStock: 1 },
    { name: 'Hộp giấy 8cm', unit: 'piece', cost: 3500, lowStock: 100 },
    { name: 'Hộp giấy 12cm', unit: 'piece', cost: 4500, lowStock: 100 },
    { name: 'Hộp giấy 18cm', unit: 'piece', cost: 6500, lowStock: 80 },
    { name: 'Túi giấy thương hiệu', unit: 'piece', cost: 1500, lowStock: 200 },
  ];

  const insertedMaterials = await db
    .insert(materials)
    .values(
      matSeed.map((m, i) => ({
        name: m.name,
        unit: m.unit,
        costPerUnitCents: m.cost,
        qtyOnHand: String(m.lowStock * (2 + (i % 4))), // > threshold to start
        lowStockThreshold: String(m.lowStock),
        supplierId: insertedSuppliers[i % insertedSuppliers.length]!.id,
        active: true,
      })),
    )
    .returning();

  // ── MaterialMovements (60 × 6 = 360) ───────────────────────────
  const movementRows: Array<typeof materialMovements.$inferInsert> = [];
  for (const mat of insertedMaterials) {
    const opening = Number(mat.qtyOnHand);
    movementRows.push({
      materialId: mat.id,
      deltaQty: String(opening),
      reason: 'opening_balance',
      unitCostCents: mat.costPerUnitCents,
      notes: 'Số dư đầu kỳ',
      createdBy: owner.id,
    });
    for (let i = 0; i < 3; i++) {
      movementRows.push({
        materialId: mat.id,
        deltaQty: String(ri(2, 12)),
        reason: 'purchase',
        unitCostCents: mat.costPerUnitCents,
        notes: 'Nhập kho định kỳ',
        createdBy: choice([owner.id, staff1.id, staff2.id]),
      });
    }
    movementRows.push({
      materialId: mat.id,
      deltaQty: String(-ri(1, 4)),
      reason: 'consumption',
      notes: 'Sử dụng theo đơn hàng',
      createdBy: choice([staff1.id, staff2.id]),
    });
    movementRows.push({
      materialId: mat.id,
      deltaQty: String(-ri(0, 1)),
      reason: 'waste',
      notes: 'Hao hụt',
      createdBy: choice([staff1.id, staff2.id]),
    });
  }
  await db.insert(materialMovements).values(movementRows);

  // ── MenuCategories (8) ─────────────────────────────────────────
  const insertedCategories = await db
    .insert(menuCategories)
    .values([
      { name: 'Bánh ngọt', slug: 'banh-ngot', sortOrder: 1 },
      { name: 'Bánh kem', slug: 'banh-kem', sortOrder: 2 },
      { name: 'Bánh mì', slug: 'banh-mi', sortOrder: 3 },
      { name: 'Bánh quy', slug: 'banh-quy', sortOrder: 4 },
      { name: 'Bánh croissant', slug: 'banh-croissant', sortOrder: 5 },
      { name: 'Bánh trung thu', slug: 'banh-trung-thu', sortOrder: 6 },
      { name: 'Đồ uống', slug: 'do-uong', sortOrder: 7 },
      { name: 'Combo', slug: 'combo', sortOrder: 8 },
    ])
    .returning();

  // ── MenuItems (60) ─────────────────────────────────────────────
  const itemSeed: Array<{ name: string; cat: string; price: number }> = [
    { name: 'Bánh kem dâu tươi', cat: 'banh-kem', price: 350000 },
    { name: 'Tiramisu cà phê', cat: 'banh-kem', price: 65000 },
    { name: 'Cheesecake New York', cat: 'banh-kem', price: 75000 },
    { name: 'Cheesecake việt quất', cat: 'banh-kem', price: 78000 },
    { name: 'Bánh kem chocolate', cat: 'banh-kem', price: 380000 },
    { name: 'Bánh kem trà xanh', cat: 'banh-kem', price: 360000 },
    { name: 'Mille-feuille truyền thống', cat: 'banh-ngot', price: 55000 },
    { name: 'Eclair vani', cat: 'banh-ngot', price: 35000 },
    { name: 'Eclair chocolate', cat: 'banh-ngot', price: 38000 },
    { name: 'Bánh tart trứng Bồ Đào Nha', cat: 'banh-ngot', price: 28000 },
    { name: 'Bánh tart dâu', cat: 'banh-ngot', price: 45000 },
    { name: 'Bánh tart chanh', cat: 'banh-ngot', price: 42000 },
    { name: 'Bánh su kem vani', cat: 'banh-ngot', price: 22000 },
    { name: 'Bánh su kem chocolate', cat: 'banh-ngot', price: 25000 },
    { name: 'Bánh bông lan trứng muối', cat: 'banh-ngot', price: 35000 },
    { name: 'Bánh chiffon trà xanh', cat: 'banh-ngot', price: 45000 },
    { name: 'Bánh flan caramel', cat: 'banh-ngot', price: 25000 },
    { name: 'Bánh donut chocolate', cat: 'banh-ngot', price: 28000 },
    { name: 'Bánh donut đường', cat: 'banh-ngot', price: 22000 },
    { name: 'Bánh muffin việt quất', cat: 'banh-ngot', price: 32000 },
    { name: 'Bánh muffin chocolate', cat: 'banh-ngot', price: 35000 },
    { name: 'Bánh brownies hạt óc chó', cat: 'banh-ngot', price: 42000 },
    { name: 'Bánh madeleine', cat: 'banh-ngot', price: 18000 },
    { name: 'Bánh financier hạnh nhân', cat: 'banh-ngot', price: 22000 },
    { name: 'Bánh croissant bơ Pháp', cat: 'banh-croissant', price: 38000 },
    { name: 'Bánh croissant chocolate (pain au chocolat)', cat: 'banh-croissant', price: 42000 },
    { name: 'Bánh croissant hạnh nhân', cat: 'banh-croissant', price: 48000 },
    { name: 'Bánh croissant kem trứng', cat: 'banh-croissant', price: 45000 },
    { name: 'Bánh croissant phô mai', cat: 'banh-croissant', price: 42000 },
    { name: 'Bánh mì baguette truyền thống', cat: 'banh-mi', price: 18000 },
    { name: 'Bánh mì sourdough', cat: 'banh-mi', price: 65000 },
    { name: 'Bánh mì hoa cúc (brioche)', cat: 'banh-mi', price: 85000 },
    { name: 'Bánh mì sữa', cat: 'banh-mi', price: 22000 },
    { name: 'Bánh mì gối nguyên cám', cat: 'banh-mi', price: 55000 },
    { name: 'Bánh mì ngũ cốc', cat: 'banh-mi', price: 65000 },
    { name: 'Bánh quy bơ Đan Mạch', cat: 'banh-quy', price: 18000 },
    { name: 'Bánh quy chocolate chip', cat: 'banh-quy', price: 22000 },
    { name: 'Bánh quy bơ hạnh nhân', cat: 'banh-quy', price: 25000 },
    { name: 'Bánh quy mè đen', cat: 'banh-quy', price: 18000 },
    { name: 'Bánh quy yến mạch nho khô', cat: 'banh-quy', price: 24000 },
    { name: 'Bánh quy bơ trà xanh', cat: 'banh-quy', price: 28000 },
    { name: 'Bánh trung thu thập cẩm', cat: 'banh-trung-thu', price: 75000 },
    { name: 'Bánh trung thu đậu xanh', cat: 'banh-trung-thu', price: 65000 },
    { name: 'Bánh trung thu hạt sen', cat: 'banh-trung-thu', price: 72000 },
    { name: 'Bánh trung thu trà xanh trứng muối', cat: 'banh-trung-thu', price: 95000 },
    { name: 'Bánh trung thu khoai môn', cat: 'banh-trung-thu', price: 78000 },
    { name: 'Bánh trung thu sô cô la lava', cat: 'banh-trung-thu', price: 88000 },
    { name: 'Cà phê đen đá', cat: 'do-uong', price: 25000 },
    { name: 'Cà phê sữa đá', cat: 'do-uong', price: 30000 },
    { name: 'Cappuccino', cat: 'do-uong', price: 45000 },
    { name: 'Latte', cat: 'do-uong', price: 48000 },
    { name: 'Trà ô long sữa', cat: 'do-uong', price: 38000 },
    { name: 'Trà đào cam sả', cat: 'do-uong', price: 40000 },
    { name: 'Hot chocolate', cat: 'do-uong', price: 50000 },
    { name: 'Matcha latte', cat: 'do-uong', price: 55000 },
    { name: 'Combo Tiramisu + Cà phê', cat: 'combo', price: 90000 },
    { name: 'Combo Croissant + Latte', cat: 'combo', price: 80000 },
    { name: 'Combo Trung thu 4 vị', cat: 'combo', price: 320000 },
    { name: 'Combo bánh kem nhỏ + 2 nước', cat: 'combo', price: 280000 },
    { name: 'Combo sinh nhật trẻ em', cat: 'combo', price: 450000 },
  ];
  // pad to 60 if list ends short
  while (itemSeed.length < 60) {
    itemSeed.push({ name: `Bánh ngọt #${itemSeed.length + 1}`, cat: 'banh-ngot', price: 30000 + ri(0, 50000) });
  }

  const catBySlug = new Map(insertedCategories.map((c) => [c.slug, c.id]));
  const insertedMenuItems = await db
    .insert(menuItems)
    .values(
      itemSeed.slice(0, 60).map((it, i) => ({
        name: it.name,
        slug: `menu-${i + 1}-${it.cat}`,
        description: `${it.name} — handmade tại Ngọt.`,
        photoUrl: null,
        priceCents: it.price,
        categoryId: catBySlug.get(it.cat) ?? insertedCategories[0]!.id,
        cogsSnapshotCents: Math.floor(it.price * 0.32),
        shelfLifeHours: it.cat === 'banh-mi' || it.cat === 'banh-croissant' ? 24 : it.cat === 'banh-kem' ? 48 : 72,
        active: true,
      })),
    )
    .returning();

  // ── Recipes (60 × 4 = 240) ─────────────────────────────────────
  const recipeRows: Array<typeof recipes.$inferInsert> = [];
  for (const item of insertedMenuItems) {
    const ingredients = new Set<number>();
    while (ingredients.size < 4) ingredients.add(insertedMaterials[ri(0, insertedMaterials.length - 1)]!.id);
    for (const matId of ingredients) {
      recipeRows.push({
        menuItemId: item.id,
        materialId: matId,
        qtyUsed: String((rand() * 0.3 + 0.05).toFixed(3)),
      });
    }
  }
  await db.insert(recipes).values(recipeRows);

  // ── Customers (60) ─────────────────────────────────────────────
  const firstNames = ['Hương', 'Lan', 'Hằng', 'Trang', 'Linh', 'Thảo', 'Nhi', 'Mai', 'Yến', 'Phương', 'Minh', 'Tuấn', 'Hùng', 'Long', 'Khánh', 'Đức', 'Phúc', 'Quân', 'Bảo', 'Nam'];
  const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const middleM = ['Văn', 'Hữu', 'Quốc', 'Anh'];
  const middleF = ['Thị', 'Ngọc', 'Thu', 'Kim', 'Diệu'];
  const districts = ['Q.1, TP.HCM', 'Q.3, TP.HCM', 'Q.5, TP.HCM', 'Q.7, TP.HCM', 'Q.10, TP.HCM', 'Bình Thạnh, TP.HCM', 'Phú Nhuận, TP.HCM', 'Tân Bình, TP.HCM', 'Q.Hoàn Kiếm, Hà Nội', 'Q.Đống Đa, Hà Nội', 'Q.Cầu Giấy, Hà Nội', 'Q.Hai Bà Trưng, Hà Nội'];
  const customerRows: Array<typeof customers.$inferInsert> = [];
  for (let i = 0; i < 60; i++) {
    const isF = i % 2 === 0;
    const sur = choice(surnames);
    const mid = choice(isF ? middleF : middleM);
    const fn = choice(firstNames);
    const fullName = `${sur} ${mid} ${fn}`;
    customerRows.push({
      name: fullName,
      phone: `+849${ri(10000000, 99999999)}`,
      address: `${ri(1, 500)} đường ${choice(['Lê Lợi', 'Nguyễn Trãi', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Pasteur', 'Võ Văn Tần', 'Lý Tự Trọng'])}, ${choice(districts)}`,
      consentGivenAt: rand() < 0.9 ? new Date(Date.now() - ri(1, 60) * 86400000) : null,
      totalSpentCents: 0,
      orderCount: 0,
    });
  }
  const insertedCustomers = await db.insert(customers).values(customerRows).returning();

  // ── Campaigns (60) ─────────────────────────────────────────────
  const campaignNames = [
    'Khuyến mãi 8/3', 'Combo Trung thu 2026', 'Giảm giá Tết Nguyên Đán', 'Mua 2 tặng 1 bánh kem', 'Học sinh sinh viên giảm 10%',
    'Khai trương cơ sở mới', 'Sinh nhật cửa hàng', 'Cuối tuần ngọt ngào', 'Cà phê + Bánh combo', 'Giảm 15% đơn từ 500k',
    'Black Friday Ngọt', 'Lễ Tình Nhân 14/2', 'Quốc tế Phụ nữ 20/10', 'Trung thu hạnh phúc', 'Halloween bánh quy ma',
    'Giáng sinh ấm áp', 'Tết Tây mừng năm mới', 'Mừng năm học mới', 'Hè mát lạnh', 'Chào hè 2026',
  ];
  while (campaignNames.length < 60) campaignNames.push(`Khuyến mãi #${campaignNames.length + 1}`);
  const now = Date.now();
  const campaignRows: Array<typeof campaigns.$inferInsert> = [];
  for (let i = 0; i < 60; i++) {
    const offsetDays = ri(-90, 90);
    const start = new Date(now + offsetDays * 86400000);
    const end = new Date(now + (offsetDays + ri(7, 30)) * 86400000);
    const type = rand() < 0.6 ? 'percentage' : 'fixed';
    campaignRows.push({
      name: campaignNames[i]!,
      description: `${campaignNames[i]} — Áp dụng tại Ngọt Patissiere & More.`,
      type,
      value: type === 'percentage' ? ri(5, 25) : ri(20000, 100000),
      appliesTo: choice(['all', 'category', 'item'] as const),
      appliesToId: null,
      startsAt: start,
      endsAt: end,
      active: true,
      redemptionCount: ri(0, 40),
    });
  }
  const insertedCampaigns = await db.insert(campaigns).values(campaignRows).returning();

  // ── Orders (60) + OrderItems (180) ─────────────────────────────
  type Status = 'new' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'canceled';
  const statusDistribution: Status[] = [
    ...Array(15).fill('new' as Status),
    ...Array(10).fill('confirmed' as Status),
    ...Array(10).fill('preparing' as Status),
    ...Array(8).fill('ready' as Status),
    ...Array(12).fill('delivered' as Status),
    ...Array(5).fill('canceled' as Status),
  ];

  const orderRows: Array<typeof orders.$inferInsert> = [];
  const orderItemRows: Array<typeof orderItems.$inferInsert> = [];
  const stamp = (status: Status, base: number) => {
    const d = new Date(base);
    if (status === 'new') return { confirmedAt: null, preparingAt: null, readyAt: null, deliveredAt: null, canceledAt: null };
    if (status === 'canceled') return { confirmedAt: null, preparingAt: null, readyAt: null, deliveredAt: null, canceledAt: new Date(d.getTime() + ri(10, 120) * 60000) };
    const c = new Date(d.getTime() + ri(5, 30) * 60000);
    if (status === 'confirmed') return { confirmedAt: c, preparingAt: null, readyAt: null, deliveredAt: null, canceledAt: null };
    const p = new Date(c.getTime() + ri(10, 60) * 60000);
    if (status === 'preparing') return { confirmedAt: c, preparingAt: p, readyAt: null, deliveredAt: null, canceledAt: null };
    const r = new Date(p.getTime() + ri(20, 90) * 60000);
    if (status === 'ready') return { confirmedAt: c, preparingAt: p, readyAt: r, deliveredAt: null, canceledAt: null };
    const dv = new Date(r.getTime() + ri(15, 120) * 60000);
    return { confirmedAt: c, preparingAt: p, readyAt: r, deliveredAt: dv, canceledAt: null };
  };

  const todayPrefix = new Date();
  for (let i = 0; i < 60; i++) {
    const status = statusDistribution[i] as Status;
    const createdAt = new Date(now - ri(0, 14) * 86400000 - ri(0, 12) * 3600000);
    const day = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
    const code = `NG-${day}-${String(i + 1).padStart(3, '0')}`;
    const customer = choice(insertedCustomers);
    const itemsCount = 3;
    let subtotal = 0;
    const orderItemBuf: Array<{ menuItemId: number; qty: number; unitPriceCents: number; nameSnapshot: string }> = [];
    for (let k = 0; k < itemsCount; k++) {
      const mi = choice(insertedMenuItems);
      const qty = ri(1, 4);
      subtotal += mi.priceCents * qty;
      orderItemBuf.push({ menuItemId: mi.id, qty, unitPriceCents: mi.priceCents, nameSnapshot: mi.name });
    }
    const useCampaign = rand() < 0.3 ? choice(insertedCampaigns) : null;
    const discount = useCampaign ? (useCampaign.type === 'percentage' ? Math.floor((subtotal * useCampaign.value) / 100) : useCampaign.value) : 0;
    const vatPct = 8;
    const taxable = Math.max(0, subtotal - discount);
    const vatCents = Math.floor((taxable * vatPct) / 100);
    const total = taxable + vatCents;
    const stamps = stamp(status, createdAt.getTime());
    orderRows.push({
      code,
      customerId: customer.id,
      status,
      subtotalCents: subtotal,
      discountCents: discount,
      campaignId: useCampaign?.id ?? null,
      vatPct,
      vatCents,
      totalCents: total,
      deadlineAt: new Date(createdAt.getTime() + ri(2, 6) * 3600000),
      paymentMethod: choice(['VietQR', 'MoMo', 'ZaloPay', 'BankTransfer', 'Cash', 'COD'] as const),
      paymentStatus: status === 'delivered' ? 'paid' : status === 'canceled' ? 'unpaid' : choice(['unpaid', 'paid'] as const),
      paymentReconciledAt: null,
      notes: null,
      createdBy: choice([staff1.id, staff2.id]),
      createdAt,
      ...stamps,
      telegramAlertsSent: [],
    });
    // attach items after we know order id (insert in 2nd pass)
    (orderRows[orderRows.length - 1] as any).__items = orderItemBuf;
  }
  const insertedOrders = await db.insert(orders).values(orderRows.map(({ ...rest }) => { const r: any = rest; delete r.__items; return r; })).returning();
  // Backfill order items using __items captured per row index
  for (let i = 0; i < insertedOrders.length; i++) {
    const o = insertedOrders[i]!;
    const buf = (orderRows[i] as any).__items as Array<{ menuItemId: number; qty: number; unitPriceCents: number; nameSnapshot: string }>;
    for (const it of buf) {
      orderItemRows.push({
        orderId: o.id,
        menuItemId: it.menuItemId,
        qty: it.qty,
        unitPriceCents: it.unitPriceCents,
        lineTotalCents: it.unitPriceCents * it.qty,
        itemNameSnapshot: it.nameSnapshot,
      });
    }
  }
  await db.insert(orderItems).values(orderItemRows);

  // ── Expenses (60) ──────────────────────────────────────────────
  const expenseRows: Array<typeof expenses.$inferInsert> = [];
  const cats = ['rent', 'utilities', 'labor', 'packaging', 'marketing', 'ingredients_other', 'other'] as const;
  for (let i = 0; i < 60; i++) {
    const daysAgo = ri(0, 180);
    const d = new Date(now - daysAgo * 86400000);
    const cat = choice(cats);
    const amounts: Record<string, [number, number]> = {
      rent: [15000000, 15000000],
      utilities: [800000, 2500000],
      labor: [4000000, 8000000],
      packaging: [200000, 1500000],
      marketing: [300000, 3000000],
      ingredients_other: [100000, 800000],
      other: [50000, 500000],
    };
    const [lo, hi] = amounts[cat]!;
    expenseRows.push({
      date: d.toISOString().slice(0, 10),
      category: cat,
      amountCents: ri(lo, hi),
      description: `Chi phí ${cat}`,
      createdBy: owner.id,
      createdAt: d,
    });
  }
  await db.insert(expenses).values(expenseRows);

  // ── TelegramAlerts (60) ────────────────────────────────────────
  const tgRows: Array<typeof telegramAlerts.$inferInsert> = [];
  const tgKinds = ['order_confirmed', 'order_deadline_soon', 'order_status_changed', 'low_inventory', 'manual_test'] as const;
  const tgErrors = ['HTTP 401: chat not found', 'rate limit exceeded', 'network timeout', 'HTTP 400: bot was blocked by the user'];
  for (let i = 0; i < 60; i++) {
    const ok = rand() < 0.75;
    tgRows.push({
      kind: choice(tgKinds),
      payloadJson: { sample: 'seed', i },
      chatId: '-1001234567890',
      sentAt: new Date(now - ri(0, 90) * 86400000),
      succeeded: ok,
      errorMsg: ok ? null : choice(tgErrors),
    });
  }
  await db.insert(telegramAlerts).values(tgRows);

  // ── SheetSyncLogs (60) ─────────────────────────────────────────
  const ssRows: Array<typeof sheetSyncLogs.$inferInsert> = [];
  const ssEntities = ['order', 'menu_item', 'material', 'customer', 'expense'] as const;
  const ssActions = ['create', 'update', 'delete'] as const;
  for (let i = 0; i < 60; i++) {
    const ok = rand() < 0.85;
    const ent = choice(ssEntities);
    ssRows.push({
      entity: ent,
      entityId: ri(1, 60),
      action: choice(ssActions),
      sheetTab: ent === 'order' ? 'Orders' : ent === 'menu_item' ? 'Menu' : ent === 'material' ? 'Materials' : ent === 'customer' ? 'Customers' : 'Expenses',
      rowIndex: ok ? ri(2, 200) : null,
      succeeded: ok,
      errorMsg: ok ? null : 'service account quota exceeded',
      syncedAt: new Date(now - ri(0, 30) * 86400000),
    });
  }
  await db.insert(sheetSyncLogs).values(ssRows);

  // ── AuditEvents (60) ───────────────────────────────────────────
  const aeRows: Array<typeof auditEvents.$inferInsert> = [];
  const aeActions = ['create', 'update', 'delete', 'signin', 'signout', 'transition_order', 'consume_materials'] as const;
  const aeEntities = ['Order', 'MenuItem', 'Material', 'Customer', 'Expense', 'Campaign'];
  for (let i = 0; i < 55; i++) {
    aeRows.push({
      actorUserId: choice(allUsers).id,
      action: choice(aeActions),
      entity: choice(aeEntities),
      entityId: ri(1, 60),
      ipAddress: '127.0.0.1',
      createdAt: new Date(now - ri(0, 180) * 86400000),
    });
  }
  // 5 failed_signin entries
  for (let i = 0; i < 5; i++) {
    aeRows.push({
      actorUserId: null,
      action: 'failed_signin',
      entity: null,
      entityId: null,
      ipAddress: '203.0.113.' + ri(1, 254),
      createdAt: new Date(now - ri(0, 30) * 86400000),
    });
  }
  await db.insert(auditEvents).values(aeRows);

  // ── Summary ────────────────────────────────────────────────────
  const counts = {
    users: 3,
    suppliers: 8,
    materials: 60,
    materialMovements: 360,
    menuCategories: 8,
    menuItems: 60,
    recipes: recipeRows.length,
    customers: 60,
    orders: 60,
    orderItems: orderItemRows.length,
    campaigns: 60,
    expenses: 60,
    telegramAlerts: 60,
    sheetSyncLogs: 60,
    auditEvents: 60,
  };
  console.log('seed: row counts:', counts);
  console.log(`seed: done. Sign in as ${OWNER1_EMAIL} or ${OWNER2_EMAIL} (default password: ngot1234 — change immediately).`);
  await pool.end();
}

main().catch((e) => {
  console.error('seed: failed', e);
  process.exit(1);
});
