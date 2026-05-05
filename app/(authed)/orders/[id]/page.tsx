import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrderDetail } from '@/lib/queries/orders';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { Button } from '@/components/ui/button';
import { OrderActions } from './order-actions';
import type { OrderStatus } from '@/lib/db/schema';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();
  const detail = await getOrderDetail(orderId);
  if (!detail) notFound();
  const { order, items, customer, campaign } = detail;

  const TIMELINE: { status: OrderStatus; at: Date | null }[] = [
    { status: 'new', at: order.createdAt },
    { status: 'confirmed', at: order.confirmedAt },
    { status: 'preparing', at: order.preparingAt },
    { status: 'ready', at: order.readyAt },
    { status: 'delivered', at: order.deliveredAt },
    ...(order.canceledAt ? [{ status: 'canceled' as OrderStatus, at: order.canceledAt }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Đơn ${order.code}`}
        description={customer ? `Khách: ${customer.name}` : ''}
        actions={
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Link href="/orders">
              <Button variant="outline">Quay lại</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sản phẩm</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.id} className="py-3 flex justify-between text-sm">
                  <span>
                    <Link href={`/menu/${it.menuItemId}`} className="hover:underline">
                      {it.itemNameSnapshot}
                    </Link>
                    <span className="text-muted-foreground ml-2">× {it.qty}</span>
                  </span>
                  <span>
                    <CurrencyDisplay cents={it.lineTotalCents} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <CurrencyDisplay cents={order.subtotalCents} />
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Giảm giá{campaign ? ` (${campaign.name})` : ''}</span>
                  <span>− <CurrencyDisplay cents={order.discountCents} /></span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT ({order.vatPct}%)</span>
                <CurrencyDisplay cents={order.vatCents} />
              </div>
              <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                <span>Tổng cộng</span>
                <CurrencyDisplay cents={order.totalCents} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thời gian</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {TIMELINE.map((t) => (
                <li key={t.status} className="flex items-center justify-between">
                  <OrderStatusBadge status={t.status} />
                  <span className="text-xs text-muted-foreground">
                    {t.at ? <DateDisplay date={t.at} /> : '—'}
                  </span>
                </li>
              ))}
            </ul>
            {order.deadlineAt && (
              <p className="text-xs text-muted-foreground mt-4">
                Hạn giao: <DateDisplay date={order.deadlineAt} />
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hành động</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
          />
        </CardContent>
      </Card>

      {customer && (
        <Card>
          <CardHeader>
            <CardTitle>Khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <Link href={`/customers/${customer.id}`} className="hover:underline font-medium">
                {customer.name}
              </Link>
            </p>
            {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
            {customer.address && <p className="text-muted-foreground">{customer.address}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
