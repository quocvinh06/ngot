'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { recordMovement } from '@/lib/actions/inventory';
import { toast } from 'sonner';

export function MovementForm({
  materialId,
  unit,
  costPerUnitCents,
}: {
  materialId: number;
  unit: string;
  costPerUnitCents: number;
}) {
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await recordMovement(formData);
      toast.success('Đã ghi nhận giao dịch');
      const form = document.getElementById('movement-form') as HTMLFormElement | null;
      form?.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="movement-form" action={onSubmit} className="space-y-3">
      <input type="hidden" name="materialId" value={materialId} />
      <div className="space-y-2">
        <Label htmlFor="reason">Loại</Label>
        <Select id="reason" name="reason" required>
          <option value="purchase">Nhập kho</option>
          <option value="waste">Hao hụt</option>
          <option value="adjustment">Điều chỉnh (chủ cửa hàng)</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deltaQty">Số lượng ({unit}) — dương để nhập, âm để giảm</Label>
        <Input id="deltaQty" name="deltaQty" type="number" step="0.001" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unitCostCents">Đơn giá (VND, để trống dùng giá hiện tại)</Label>
        <Input id="unitCostCents" name="unitCostCents" type="number" min={0} placeholder={String(costPerUnitCents)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Ghi chú</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Đang lưu...' : 'Ghi nhận'}
      </Button>
    </form>
  );
}
