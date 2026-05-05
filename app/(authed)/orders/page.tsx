import Link from 'next/link';
import { listOrders } from '@/lib/queries/orders';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/db/schema';

export const metadata = { title: 'Đơn hàng — Ngọt' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const orders = await listOrders({ status: sp.status, page });

  const STATUS_FILTERS: { v?: string; l: string }[] = [
    { v: undefined, l: 'Tất cả' },
    { v: 'new', l: 'Mới' },
    { v: 'confirmed', l: 'Đã xác nhận' },
    { v: 'preparing', l: 'Đang chuẩn bị' },
    { v: 'ready', l: 'Sẵn sàng' },
    { v: 'delivered', l: 'Đã giao' },
    { v: 'canceled', l: 'Đã hủy' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng"
        actions={
          <Link href="/orders/new">
            <Button>+ Đơn hàng mới</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.v ?? 'all'}
            href={f.v ? `/orders?status=${f.v}` : '/orders'}
            className={`text-xs px-3 py-1 rounded-full border ${
              sp.status === f.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
          >
            {f.l}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Chưa có đơn hàng nào — bấm &quot;+ Đơn hàng mới&quot; để bắt đầu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Khách</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Hạn giao</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
                        {o.code}
                      </Link>
                    </TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status as OrderStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay cents={o.totalCents} />
                    </TableCell>
                    <TableCell>
                      {o.paymentStatus === 'paid' ? (
                        <Badge variant="success">Đã trả</Badge>
                      ) : o.paymentStatus === 'refunded' ? (
                        <Badge variant="warning">Hoàn tiền</Badge>
                      ) : (
                        <Badge variant="outline">Chưa</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={o.deadlineAt} fmt="HH:mm dd/MM" />
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={o.createdAt} fmt="dd/MM HH:mm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
