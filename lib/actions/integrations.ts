'use server';

import { auth } from '@/auth';
import { sendTelegram } from '@/lib/integrations/telegram';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

async function requireOwner() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('UNAUTHORIZED');
  if (s.user.role !== 'owner') throw new Error('FORBIDDEN');
  return s;
}

export async function testTelegram() {
  const s = await requireOwner();
  const res = await sendTelegram('manual_test', {
    message: 'Tin nhắn thử nghiệm từ Ngọt — kết nối Telegram OK.',
    sent_by: s.user.email,
    at: new Date().toISOString(),
  });
  await logAudit({ actorUserId: Number(s.user.id), action: 'create', entity: 'TelegramAlert.test' });
  revalidatePath('/settings/integrations');
  return res;
}
