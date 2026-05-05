import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/db/schema';

const VARIANT: Record<OrderStatus, BadgeProps['variant']> = {
  new: 'secondary',
  confirmed: 'default',
  preparing: 'warning',
  ready: 'success',
  delivered: 'success',
  canceled: 'destructive',
};

const LABEL_VI: Record<OrderStatus, string> = {
  new: 'Mới',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  delivered: 'Đã giao',
  canceled: 'Đã hủy',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL_VI[status]}</Badge>;
}
