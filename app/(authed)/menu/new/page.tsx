import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listCategories } from '@/lib/queries/menu';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createMenuItem } from '@/lib/actions/menu';

export default async function NewMenuItemPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/menu');
  const cats = await listCategories();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Thêm món mới" />
      <Card>
        <CardContent className="pt-6">
          <form action={createMenuItem} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên món</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoUrl">Ảnh URL (để trống — dùng ảnh tự động)</Label>
              <Input id="photoUrl" name="photoUrl" type="url" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="priceCents">Giá (VND)</Label>
                <Input id="priceCents" name="priceCents" type="number" min={0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Danh mục</Label>
                <Select id="categoryId" name="categoryId" required>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shelfLifeHours">Hạn sử dụng (giờ, để trống nếu không áp dụng)</Label>
              <Input id="shelfLifeHours" name="shelfLifeHours" type="number" min={1} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit">Lưu</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
