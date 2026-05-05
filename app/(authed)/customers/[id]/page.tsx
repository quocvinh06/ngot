import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getCustomerDetail } from '@/lib/queries/customers';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomerActions } from './customer-actions';
import type { OrderStatus } from '@/lib/db/schema';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) notFound();
  const detail = await getCustomerDetail(cid);
  if (!detail) notFound();
  const { customer, recentOrders } = detail;
  const isOwner = session?.user?.role === 'owner';

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={customer.phone ?? ''}
        actions={
          <Link href="/customers">
            <Button variant="outline">Quay lại</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">SĐT: </span>
              {customer.phone ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Địa chỉ: </span>
              {customer.address ?? '—'}
            </p>
            {customer.notes && (
              <p>
                <span className="text-muted-foreground">Ghi chú: </span>
                {customer.notes}
              </p>
            )}
            <div className="border-t pt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Tổng chi tiêu</p>
                <p className="font-semibold">
                  <CurrencyDisplay cents={customer.totalSpentCents} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Số đơn</p>
                <p className="font-semibold">{customer.orderCount}</p>
              </div>
            </div>
            {customer.consentGivenAt && (
              <p className="text-xs text-emerald-700">
                ✓ Đã đồng ý PDPL: <DateDisplay date={customer.consentGivenAt} fmt="dd/MM/yyyy" />
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row flex justify-between items-center">
            <CardTitle>Lịch sử đơn hàng</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đơn hàng.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Tổng</TableHead>
                    <TableHead>Ngày</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/orders/${o.id}`} className="font-mono hover:underline">
                          {o.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status as OrderStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay cents={o.totalCents} />
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

      {isOwner && !customer.deletedAt && (
        <Card>
          <CardHeader>
            <CardTitle>Quyền dữ liệu cá nhân (PDPL)</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerActions customerId={customer.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
