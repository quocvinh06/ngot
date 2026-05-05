import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listSuppliers } from '@/lib/queries/inventory';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createMaterial } from '@/lib/actions/inventory';

export default async function NewMaterialPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/inventory');
  const sups = await listSuppliers();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Thêm nguyên liệu" />
      <Card>
        <CardContent className="pt-6">
          <form action={createMaterial} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit">Đơn vị</Label>
                <Select id="unit" name="unit" required>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="piece">cái</option>
                  <option value="box">hộp</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPerUnitCents">Giá / đơn vị (VND)</Label>
                <Input id="costPerUnitCents" name="costPerUnitCents" type="number" min={0} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qtyOnHand">Tồn ban đầu</Label>
                <Input id="qtyOnHand" name="qtyOnHand" type="number" step="0.001" defaultValue={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Ngưỡng cảnh báo</Label>
                <Input id="lowStockThreshold" name="lowStockThreshold" type="number" step="0.001" defaultValue={0} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Nhà cung cấp (tùy chọn)</Label>
              <Select id="supplierId" name="supplierId">
                <option value="">— Không chọn —</option>
                {sups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
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
