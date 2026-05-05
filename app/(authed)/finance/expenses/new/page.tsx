import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createExpense } from '@/lib/actions/expenses';

export default async function NewExpensePage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Chi phí mới" />
      <Card>
        <CardContent className="pt-6">
          <form action={createExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Ngày</Label>
                <Input id="date" name="date" type="date" defaultValue={today} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Loại</Label>
                <Select id="category" name="category" required>
                  <option value="rent">Mặt bằng</option>
                  <option value="utilities">Điện nước</option>
                  <option value="labor">Lương</option>
                  <option value="packaging">Bao bì</option>
                  <option value="marketing">Marketing</option>
                  <option value="ingredients_other">Nguyên liệu khác</option>
                  <option value="other">Khác</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountCents">Số tiền (VND)</Label>
              <Input id="amountCents" name="amountCents" type="number" min={0} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={2} />
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
