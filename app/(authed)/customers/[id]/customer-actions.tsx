'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { anonymizeCustomer } from '@/lib/actions/customers';
import { toast } from 'sonner';

export function CustomerActions({ customerId }: { customerId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/customers/${customerId}/export-dsr`}>
        <Button variant="outline">Xuất dữ liệu (PDPL)</Button>
      </a>
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (
              !confirm(
                'Hành động này sẽ ẩn danh thông tin cá nhân của khách hàng theo Luật PDPL 91/2025. Đơn hàng cũ vẫn được giữ. Tiếp tục?',
              )
            )
              return;
            try {
              await anonymizeCustomer(customerId);
              toast.success('Đã ẩn danh khách hàng');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Lỗi');
            }
          })
        }
      >
        Xóa theo PDPL
      </Button>
    </div>
  );
}
