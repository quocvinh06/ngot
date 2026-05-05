import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listCampaigns } from '@/lib/queries/campaigns';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateDisplay } from '@/components/date-display';
import { CurrencyDisplay } from '@/components/currency-display';

export default async function CampaignsPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  const list = await listCampaigns();
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Khuyến mãi"
        actions={
          <Link href="/campaigns/new">
            <Button>+ Khuyến mãi mới</Button>
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chưa có khuyến mãi nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Giá trị</TableHead>
                  <TableHead>Áp dụng cho</TableHead>
                  <TableHead>Bắt đầu</TableHead>
                  <TableHead>Kết thúc</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => {
                  const status =
                    !c.active
                      ? { label: 'Tạm ngưng', variant: 'outline' as const }
                      : c.endsAt < now
                      ? { label: 'Hết hạn', variant: 'outline' as const }
                      : c.startsAt > now
                      ? { label: 'Sắp tới', variant: 'warning' as const }
                      : { label: 'Đang chạy', variant: 'success' as const };
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/campaigns/${c.id}`} className="hover:underline font-medium">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>{c.type === 'percentage' ? 'Phần trăm' : 'Cố định'}</TableCell>
                      <TableCell className="text-right">
                        {c.type === 'percentage' ? `${c.value}%` : <CurrencyDisplay cents={c.value} />}
                      </TableCell>
                      <TableCell>{c.appliesTo}</TableCell>
                      <TableCell>
                        <DateDisplay date={c.startsAt} fmt="dd/MM/yy" />
                      </TableCell>
                      <TableCell>
                        <DateDisplay date={c.endsAt} fmt="dd/MM/yy" />
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
