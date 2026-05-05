import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendTelegram } from '@/lib/integrations/telegram';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const result = await sendTelegram('manual_test', {
    message: 'Tin nhắn thử nghiệm từ Ngọt — kết nối Telegram OK.',
    sent_by: session.user.email,
    at: new Date().toISOString(),
  });
  await logAudit({
    actorUserId: Number(session.user.id),
    action: 'create',
    entity: 'TelegramAlert.test',
  });
  return NextResponse.json(result);
}
