import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

export default async function VatSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Thuế GTGT" description="Cài đặt VAT theo Luật 48/2024/QH15." />
      <Card>
        <CardHeader>
          <CardTitle>Mặc định hiện tại</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Thuế suất mặc định: <span className="font-semibold">8%</span> (áp dụng tạm thời cho F&amp;B đến 31/12/2026 theo
            Luật 48/2024/QH15).
          </p>
          <p>
            Tiền tố hóa đơn: <span className="font-mono">NG-YYYYMMDD-NNN</span>.
          </p>
          <Alert variant="warning">
            Cửa hàng dưới 500 triệu/năm có thể được miễn thuế GTGT (theo ngưỡng từ 1/1/2026). Liên hệ kế toán để xác nhận
            áp dụng. Việc bật/tắt miễn thuế sẽ được lưu trên hồ sơ chủ cửa hàng.
          </Alert>
          <p className="text-xs text-muted-foreground">
            Lưu ý: VAT được lưu cố định trên từng đơn (Order.vat_pct + Order.vat_cents) — thay đổi cài đặt chỉ ảnh hưởng
            đơn mới.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
