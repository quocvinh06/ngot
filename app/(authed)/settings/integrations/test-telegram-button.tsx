'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { testTelegram } from '@/lib/actions/integrations';
import { toast } from 'sonner';

export function TestTelegramButton({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || !enabled}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await testTelegram();
            if (res.ok) toast.success('Đã gửi tin Telegram thử nghiệm');
            else toast.error(res.error ?? 'Lỗi gửi Telegram');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Lỗi');
          }
        })
      }
    >
      {pending ? 'Đang gửi...' : 'Gửi tin thử nghiệm'}
    </Button>
  );
}
