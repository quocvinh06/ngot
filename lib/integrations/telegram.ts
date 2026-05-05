import { db } from '@/lib/db';
import { telegramAlerts } from '@/lib/db/schema';

type TelegramKind =
  | 'order_confirmed'
  | 'order_deadline_soon'
  | 'order_status_changed'
  | 'low_inventory'
  | 'manual_test';

const KIND_TO_VI: Record<TelegramKind, string> = {
  order_confirmed: 'Đơn hàng mới',
  order_deadline_soon: 'Đơn hàng sắp đến hạn',
  order_status_changed: 'Cập nhật trạng thái đơn',
  low_inventory: 'Cảnh báo tồn kho thấp',
  manual_test: 'Tin nhắn thử nghiệm',
};

function formatBody(kind: TelegramKind, payload: Record<string, unknown>): string {
  const title = KIND_TO_VI[kind];
  const lines = [`<b>Ngọt — ${title}</b>`];
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) continue;
    lines.push(`<b>${k}</b>: ${String(v)}`);
  }
  return lines.join('\n');
}

export async function sendTelegram(
  kind: TelegramKind,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    await db.insert(telegramAlerts).values({
      kind,
      payloadJson: payload as never,
      chatId: chatId ?? '',
      succeeded: false,
      errorMsg: 'env not configured',
    });
    return { ok: false, error: 'env not configured' };
  }
  const body = formatBody(kind, payload);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      const errText = `HTTP ${res.status}: ${await res.text().catch(() => '')}`.slice(0, 300);
      await db.insert(telegramAlerts).values({
        kind,
        payloadJson: payload as never,
        chatId,
        succeeded: false,
        errorMsg: errText,
      });
      return { ok: false, error: errText };
    }
    await db.insert(telegramAlerts).values({
      kind,
      payloadJson: payload as never,
      chatId,
      succeeded: true,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.insert(telegramAlerts).values({
      kind,
      payloadJson: payload as never,
      chatId,
      succeeded: false,
      errorMsg: msg.slice(0, 300),
    });
    return { ok: false, error: msg };
  }
}
