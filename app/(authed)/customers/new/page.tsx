import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PdplConsentCheckbox } from '@/components/pdpl-consent-checkbox';
import { createCustomer } from '@/lib/actions/customers';

export default function NewCustomerPage() {
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Khách hàng mới" description="Yêu cầu đồng ý PDPL trước khi lưu." />
      <Card>
        <CardContent className="pt-6">
          <form action={createCustomer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Họ tên</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input id="phone" name="phone" inputMode="tel" placeholder="+84 ..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Textarea id="address" name="address" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Ghi chú</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="border rounded-md bg-cream/40 p-3">
              <PdplConsentCheckbox required />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit">Lưu khách hàng</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
