'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { transitionOrder, reconcilePayment } from '@/lib/actions/orders';
import { toast } from 'sonner';
import type { OrderStatus, PaymentStatus } from '@/lib/db/schema';

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: 'Xác nhận đơn',
  confirmed: 'Bắt đầu chuẩn bị',
  preparing: 'Đánh dấu sẵn sàng',
  ready: 'Đã giao',
};

export function OrderActions({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const next = NEXT_LABEL[status];
  const terminal = status === 'delivered' || status === 'canceled';

  return (
    <div className="flex flex-wrap gap-2">
      {next && !terminal && (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await transitionOrder(orderId, 'next');
                toast.success(next);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Lỗi');
              }
            })
          }
        >
          {next}
        </Button>
      )}
      {!terminal && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!confirm('Hủy đơn này? Tồn kho đã trừ sẽ được hoàn lại.')) return;
              try {
                await transitionOrder(orderId, 'canceled');
                toast.success('Đã hủy đơn');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Lỗi');
              }
            })
          }
        >
          Hủy đơn
        </Button>
      )}
      {paymentStatus !== 'paid' && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await reconcilePayment(orderId, 'paid');
                toast.success('Đã đối soát thanh toán');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Lỗi');
              }
            })
          }
        >
          Đánh dấu đã thanh toán
        </Button>
      )}
    </div>
  );
}
