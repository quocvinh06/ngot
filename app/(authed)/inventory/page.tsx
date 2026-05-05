import Link from 'next/link';
import { auth } from '@/auth';
import { listMaterials } from '@/lib/queries/inventory';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

export const metadata = { title: 'Kho nguyên liệu — Ngọt' };

export default async function InventoryPage() {
  const session = await auth();
  const isOwner = session?.user?.role === 'owner';
  const items = await listMaterials();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kho nguyên liệu"
        actions={
          <div className="flex gap-2">
            {isOwner && (
              <>
                <Link href="/inventory/suppliers">
                  <Button variant="outline">Nhà cung cấp</Button>
                </Link>
                <Link href="/inventory/new">
                  <Button>+ Nguyên liệu mới</Button>
                </Link>
              </>
            )}
          </div>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Chưa có nguyên liệu — thêm nguyên liệu đầu tiên để theo dõi tồn kho.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead className="text-right">Tồn kho</TableHead>
                  <TableHead className="text-right">Ngưỡng</TableHead>
                  <TableHead>Mức tồn</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead>NCC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => {
                  const qty = Number(m.qtyOnHand);
                  const thr = Number(m.lowStockThreshold);
                  const low = thr > 0 && qty <= thr;
                  const fillPct = thr > 0 ? Math.min(100, (qty / (thr * 2)) * 100) : 100;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link href={`/inventory/${m.id}`} className="hover:underline font-medium">
                          {m.name}
                        </Link>
                        {!m.active && <Badge variant="outline" className="ml-2">Ẩn</Badge>}
                      </TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className={`text-right font-medium ${low ? 'text-destructive' : ''}`}>
                        {qty.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{thr.toFixed(2)}</TableCell>
                      <TableCell className="w-32">
                        <Progress value={fillPct} className={low ? '[&>div]:bg-destructive' : ''} />
                      </TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay cents={m.costPerUnitCents} />
                      </TableCell>
                      <TableCell>{m.supplierName ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
