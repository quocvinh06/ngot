import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TABS = [
  { href: '/settings/staff', title: 'Nhân viên', desc: 'Tạo, quản lý tài khoản nhân viên + quyền hạn.' },
  { href: '/settings/integrations', title: 'Tích hợp', desc: 'Telegram bot, Google Sheet — cấu hình + kiểm tra.' },
  { href: '/settings/vat', title: 'Thuế GTGT', desc: 'Thuế suất mặc định, miễn thuế cho cửa hàng dưới ngưỡng.' },
];

export default async function SettingsHubPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  return (
    <div className="space-y-6">
      <PageHeader title="Cài đặt" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle>{t.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
