import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getCampaign } from '@/lib/queries/campaigns';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { Badge } from '@/components/ui/badge';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) notFound();
  const c = await getCampaign(cid);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={c.description ?? ''}
        actions={
          <Link href="/campaigns">
            <Button variant="outline">Quay lại</Button>
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loại</span>
            <span>{c.type === 'percentage' ? 'Phần trăm' : 'Cố định'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Giá trị</span>
            <span>{c.type === 'percentage' ? `${c.value}%` : <CurrencyDisplay cents={c.value} />}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Áp dụng cho</span>
            <span>{c.appliesTo}{c.appliesToId ? ` #${c.appliesToId}` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hiệu lực</span>
            <span>
              <DateDisplay date={c.startsAt} fmt="dd/MM/yy" /> — <DateDisplay date={c.endsAt} fmt="dd/MM/yy" />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Số lần áp dụng</span>
            <span>{c.redemptionCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trạng thái</span>
            {c.active ? <Badge variant="success">Đang chạy</Badge> : <Badge variant="outline">Tạm ngưng</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
