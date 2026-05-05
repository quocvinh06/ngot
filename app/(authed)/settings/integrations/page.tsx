import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TestTelegramButton } from './test-telegram-button';

function maskValue(v: string | undefined): string {
  if (!v || v.length === 0) return '— chưa cấu hình —';
  if (v.length <= 8) return `${v.slice(0, 2)}…${v.slice(-2)}`;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export default async function IntegrationsPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const sheetsEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  return (
    <div className="space-y-6">
      <PageHeader title="Tích hợp" description="Telegram và Google Sheets — best-effort, không chặn đơn." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Đặt biến môi trường <code className="bg-muted px-1 rounded">TELEGRAM_BOT_TOKEN</code> và{' '}
              <code className="bg-muted px-1 rounded">TELEGRAM_CHAT_ID</code> để kích hoạt.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Bot Token</p>
                <p className="font-mono text-xs">{maskValue(tgToken)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chat ID</p>
                <p className="font-mono text-xs">{maskValue(tgChat)}</p>
              </div>
            </div>
            <TestTelegramButton enabled={!!tgToken && !!tgChat} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Sheets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Chia sẻ Sheet với email service-account và đặt biến{' '}
              <code className="bg-muted px-1 rounded">GOOGLE_SHEETS_ID</code> +{' '}
              <code className="bg-muted px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code>.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Sheet ID</p>
                <p className="font-mono text-xs">{maskValue(sheetsId)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Service-account email</p>
                <p className="font-mono text-xs break-all">{sheetsEmail ?? '— chưa cấu hình —'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
