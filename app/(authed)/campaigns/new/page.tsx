import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createCampaign } from '@/lib/actions/campaigns';

export default async function NewCampaignPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');

  const today = new Date();
  const endDefault = new Date(today.getTime() + 14 * 24 * 3600 * 1000);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Khuyến mãi mới" />
      <Card>
        <CardContent className="pt-6">
          <form action={createCampaign} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="type">Loại</Label>
                <Select id="type" name="type" required>
                  <option value="percentage">Phần trăm (%)</option>
                  <option value="fixed">Cố định (VND)</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Giá trị</Label>
                <Input id="value" name="value" type="number" min={0} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appliesTo">Áp dụng cho</Label>
              <Select id="appliesTo" name="appliesTo" required>
                <option value="all">Toàn bộ thực đơn</option>
                <option value="category">Theo danh mục</option>
                <option value="item">Theo món</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appliesToId">ID (nếu chọn category/item, để trống nếu áp dụng all)</Label>
              <Input id="appliesToId" name="appliesToId" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Bắt đầu</Label>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={today.toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Kết thúc</Label>
                <Input
                  id="endsAt"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={endDefault.toISOString().slice(0, 16)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit">Lưu</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
