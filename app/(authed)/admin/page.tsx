import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { customers, telegramAlerts } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { dashboardSummary } from '@/lib/queries/orders';
import { lowStockMaterials } from '@/lib/queries/inventory';
import { pnlForPeriod } from '@/lib/queries/finance';
import { Badge } from '@/components/ui/badge';
import { pct } from '@/lib/utils';
import type { OrderStatus } from '@/lib/db/schema';

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (session.user.role !== 'owner') redirect('/staff');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [summary, lowStock, pnl, recentCust, recentTelegram] = await Promise.all([
    dashboardSummary(),
    lowStockMaterials(),
    pnlForPeriod(today, tomorrow),
    db.select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      totalSpentCents: customers.totalSpentCents,
      orderCount: customers.orderCount,
      createdAt: customers.createdAt,
    })
      .from(customers)
      .orderBy(desc(customers.createdAt))
      .limit(8),
    db.select({
      id: telegramAlerts.id,
      kind: telegramAlerts.kind,
      sentAt: telegramAlerts.sentAt,
      succeeded: telegramAlerts.succeeded,
    })
      .from(telegramAlerts)
      .orderBy(desc(telegramAlerts.sentAt))
      .limit(5),
  ]);

  const cogsThreshold = 40;
  const cogsAlert = pnl.cogsPct > cogsThreshold;
  void sql; // shimmed to satisfy import lint

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan"
        description={`Xin chào ${session.user.name ?? ''}, hôm nay là ${today.toLocaleDateString('vi-VN')}`}
        actions={
          <Link
            href="/orders/new"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + Đơn hàng mới
          </Link>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Doanh thu hôm nay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display text-cocoa">
              <CurrencyDisplay cents={summary.todayRevenue} />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{summary.todayCount} đơn đã giao</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Giá vốn (COGS)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display text-cocoa">
              <CurrencyDisplay cents={pnl.cogs} />
            </p>
            <p className={`text-xs mt-1 ${cogsAlert ? 'text-destructive' : 'text-emerald-700'}`}>
              {pct(pnl.cogs, pnl.revenue)}% / Doanh thu
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lãi gộp</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display text-cocoa">
              <CurrencyDisplay cents={pnl.grossMargin} />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{pct(pnl.grossMargin, pnl.revenue)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sắp hết hàng</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display text-cocoa">{lowStock.length}</p>
            <p className="text-xs text-muted-foreground mt-1">nguyên liệu &le; ngưỡng</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Đơn hôm nay theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đơn nào hôm nay.</p>
            ) : (
              <ul className="space-y-2">
                {summary.byStatus.map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-sm">
                    <OrderStatusBadge status={s.status as OrderStatus} />
                    <span className="font-medium">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cảnh báo tồn kho</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có nguyên liệu nào dưới ngưỡng.</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <Link href={`/inventory/${m.id}`} className="hover:underline">
                      {m.name}
                    </Link>
                    <span className="text-destructive font-medium">
                      {Number(m.qtyOnHand).toFixed(2)} {m.unit} / {Number(m.lowStockThreshold).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Khách hàng gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCust.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có khách nào.</p>
            ) : (
              <ul className="divide-y">
                {recentCust.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                    <Link href={`/customers/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {c.orderCount} đơn · <CurrencyDisplay cents={c.totalSpentCents} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hoạt động Telegram</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTelegram.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có thông báo nào.</p>
            ) : (
              <ul className="divide-y">
                {recentTelegram.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                    <span>{a.kind}</span>
                    <span className="flex items-center gap-2">
                      {a.succeeded ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="destructive">Lỗi</Badge>
                      )}
                      <DateDisplay date={a.sentAt} fmt="dd/MM HH:mm" className="text-muted-foreground" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
