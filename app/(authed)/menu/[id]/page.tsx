import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getMenuItemDetail } from '@/lib/queries/menu';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { TopicalImage } from '@/components/topical-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { pct } from '@/lib/utils';

export default async function MenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) notFound();
  const detail = await getMenuItemDetail(itemId);
  if (!detail) notFound();
  const { item, category, recipes } = detail;
  const session = await auth();
  const isOwner = session?.user?.role === 'owner';
  const margin = item.priceCents - item.cogsSnapshotCents;
  const marginPct = pct(margin, item.priceCents);

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.name}
        description={category?.name}
        actions={
          <Link href="/menu">
            <Button variant="outline">Quay lại</Button>
          </Link>
        }
      />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="recipe">Công thức ({recipes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <TopicalImage
                  src={item.photoUrl}
                  seed={`menu-${item.slug}`}
                  entityName="MenuItem"
                  alt={item.name}
                  width={800}
                  height={500}
                  className="w-full h-80 rounded-lg"
                  priority
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Chi tiết</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá bán</span>
                  <CurrencyDisplay cents={item.priceCents} className="font-semibold" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá vốn (COGS)</span>
                  <CurrencyDisplay cents={item.cogsSnapshotCents} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lãi gộp</span>
                  <span className="flex items-center gap-2">
                    <CurrencyDisplay cents={margin} />
                    <Badge variant={marginPct > 60 ? 'success' : marginPct > 40 ? 'warning' : 'destructive'}>
                      {marginPct}%
                    </Badge>
                  </span>
                </div>
                {item.shelfLifeHours && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hạn sử dụng</span>
                    <span>{item.shelfLifeHours}h</span>
                  </div>
                )}
                {item.description && (
                  <div className="border-t pt-3">
                    <p className="text-foreground/80">{item.description}</p>
                  </div>
                )}
                {!item.active && <Badge variant="outline">Tạm ngưng</Badge>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="recipe">
          <Card>
            <CardContent className="pt-6">
              {recipes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Chưa có công thức cho món này.{isOwner ? ' Mở trang quản lý để thêm.' : ''}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nguyên liệu</TableHead>
                      <TableHead className="text-right">Khối lượng</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/inventory/${r.materialId}`} className="hover:underline">
                            {r.materialName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.qtyUsed).toFixed(3)} {r.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <CurrencyDisplay cents={r.costPerUnitCents} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <CurrencyDisplay cents={Math.round(Number(r.qtyUsed) * r.costPerUnitCents)} />
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
