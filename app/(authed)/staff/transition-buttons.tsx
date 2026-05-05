'use client';
import { useTransition } from 'react';
import { transitionOrder } from '@/lib/actions/orders';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { OrderStatus } from '@/lib/db/schema';

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: '→ Xác nhận',
  confirmed: '→ Chuẩn bị',
  preparing: '→ Sẵn sàng',
  ready: '→ Đã giao',
};

export function TransitionButtons({ orderId, status }: { orderId: number; status: OrderStatus }) {
  const [pending, startTransition] = useTransition();
  if (status === 'delivered' || status === 'canceled') return null;
  const label = NEXT_LABEL[status];
  return (
    <div className="flex gap-1 mt-2">
      {label && (
        <Button
          size="sm"
          className="text-xs h-7 px-2"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await transitionOrder(orderId, 'next');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Không cập nhật được trạng thái');
              }
            })
          }
        >
          {label}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 px-2"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await transitionOrder(orderId, 'canceled');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Không hủy được');
            }
          })
        }
      >
        Hủy
      </Button>
    </div>
  );
}
