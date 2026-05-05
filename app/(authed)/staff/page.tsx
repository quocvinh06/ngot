import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { orders, customers } from '@/lib/db/schema';
import { eq, gte, desc, and, notInArray } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { lowStockMaterials } from '@/lib/queries/inventory';
import { TransitionButtons } from './transition-buttons';

import type { OrderStatus } from '@/lib/db/schema';

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'new', title: 'Mới' },
  { status: 'confirmed', title: 'Đã xác nhận' },
  { status: 'preparing', title: 'Đang chuẩn bị' },
  { status: 'ready', title: 'Sẵn sàng' },
  { status: 'delivered', title: 'Đã giao' },
  { status: 'canceled', title: 'Đã hủy' },
];

export default async function StaffKanbanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      deadlineAt: orders.deadlineAt,
      createdAt: orders.createdAt,
      customerName: customers.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        gte(orders.createdAt, since),
        notInArray(orders.status, []), // include all
      ),
    )
    .orderBy(desc(orders.createdAt));

  const lowStock = await lowStockMaterials();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khu nhân viên"
        description="Bảng đơn hàng — tự sắp xếp theo trạng thái"
        actions={
          <Link
            href="/orders/new"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + Đơn hàng mới
          </Link>
        }
      />

      {lowStock.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">Sắp hết hàng:</p>
            <ul className="flex flex-wrap gap-2 text-xs">
              {lowStock.map((m) => (
                <li key={m.id} className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-amber-900">
                  {m.name} — {Number(m.qtyOnHand).toFixed(2)} {m.unit}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {COLUMNS.map((col) => {
          const items = rows.filter((r) => r.status === col.status);
          return (
            <div key={col.status} className="bg-cream/30 rounded-lg p-3 min-h-72">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{col.title}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <ul className="space-y-2">
                {items.map((o) => (
                  <li key={o.id}>
                    <Card>
                      <CardContent className="p-3 text-xs space-y-1">
                        <Link href={`/orders/${o.id}`} className="font-mono text-sm font-semibold hover:underline">
                          {o.code}
                        </Link>
                        <p className="text-foreground/80">{o.customerName}</p>
                        <p>
                          <CurrencyDisplay cents={o.totalCents} />
                        </p>
                        {o.deadlineAt && (
                          <p className="text-muted-foreground">
                            Hạn: <DateDisplay date={o.deadlineAt} fmt="HH:mm dd/MM" />
                          </p>
                        )}
                        <OrderStatusBadge status={o.status} />
                        <TransitionButtons orderId={o.id} status={o.status} />
                      </CardContent>
                    </Card>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-xs text-muted-foreground text-center py-4">— trống —</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
