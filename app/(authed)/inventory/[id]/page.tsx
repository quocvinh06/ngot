import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMaterialDetail } from '@/lib/queries/inventory';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateDisplay } from '@/components/date-display';
import { MovementForm } from './movement-form';

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matId = Number(id);
  if (!Number.isFinite(matId)) notFound();
  const detail = await getMaterialDetail(matId);
  if (!detail) notFound();
  const { material, supplier, movements } = detail;

  const REASON_LABEL: Record<string, string> = {
    opening_balance: 'Số dư đầu kỳ',
    purchase: 'Nhập',
    consumption: 'Xuất',
    waste: 'Hao hụt',
    adjustment: 'Điều chỉnh',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={material.name}
        description={`Tồn: ${Number(material.qtyOnHand).toFixed(3)} ${material.unit}`}
        actions={
          <Link href="/inventory">
            <Button variant="outline">Quay lại</Button>
          </Link>
        }
      />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="movements">Lịch sử ({movements.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Chi tiết</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đơn vị</span>
                  <span>{material.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đơn giá</span>
                  <CurrencyDisplay cents={material.costPerUnitCents} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tồn kho</span>
                  <span className="font-medium">
                    {Number(material.qtyOnHand).toFixed(3)} {material.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngưỡng cảnh báo</span>
                  <span>
                    {Number(material.lowStockThreshold).toFixed(3)} {material.unit}
                  </span>
                </div>
                {supplier && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NCC</span>
                    <Link href={`/inventory/suppliers/${supplier.id}`} className="hover:underline">
                      {supplier.name}
                    </Link>
                  </div>
                )}
                {!material.active && <Badge variant="outline">Tạm ngưng</Badge>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ghi nhận giao dịch</CardTitle>
              </CardHeader>
              <CardContent>
                <MovementForm materialId={material.id} unit={material.unit} costPerUnitCents={material.costPerUnitCents} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="pt-6">
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Chưa có giao dịch.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead>Đơn</TableHead>
                      <TableHead>Người nhập</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <DateDisplay date={m.createdAt} />
                        </TableCell>
                        <TableCell>{REASON_LABEL[m.reason] ?? m.reason}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            Number(m.deltaQty) > 0 ? 'text-emerald-700' : 'text-destructive'
                          }`}
                        >
                          {Number(m.deltaQty) > 0 ? '+' : ''}
                          {Number(m.deltaQty).toFixed(3)} {material.unit}
                        </TableCell>
                        <TableCell>
                          {m.orderId ? (
                            <Link href={`/orders/${m.orderId}`} className="hover:underline">
                              #{m.orderId}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{m.createdByName ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {m.notes ?? ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
