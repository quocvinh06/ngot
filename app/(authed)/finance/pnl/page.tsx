import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { pnlForPeriod } from '@/lib/queries/finance';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { CurrencyDisplay } from '@/components/currency-display';
import { Progress } from '@/components/ui/progress';
import { pct } from '@/lib/utils';
import Link from 'next/link';

export const metadata = { title: 'Lãi & Lỗ — Ngọt' };

const PERIODS: { v: string; label: string; days: number }[] = [
  { v: 'today', label: 'Hôm nay', days: 1 },
  { v: '7d', label: '7 ngày', days: 7 },
  { v: '30d', label: '30 ngày', days: 30 },
  { v: '90d', label: '90 ngày', days: 90 },
];

const EXPENSE_LABEL: Record<string, string> = {
  rent: 'Mặt bằng',
  utilities: 'Điện nước',
  labor: 'Lương',
  packaging: 'Bao bì',
  marketing: 'Marketing',
  ingredients_other: 'Nguyên liệu khác',
  other: 'Khác',
};

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.v === sp.p) ?? PERIODS[2];
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - period.days + 1);
  from.setHours(0, 0, 0, 0);
  const pnl = await pnlForPeriod(from, to);
  const cogsAlert = pnl.cogsPct > 40;
  const totalExp = pnl.totalExpenses;

  return (
    <div className="space-y-6">
      <PageHeader title="Lãi & Lỗ" description={`${from.toLocaleDateString('vi-VN')} → ${to.toLocaleDateString('vi-VN')} · ${pnl.orderCount} đơn`} />

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.v}
            href={`/finance/pnl?p=${p.v}`}
            className={`text-xs px-3 py-1 rounded-full border ${
              period.v === p.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {cogsAlert && (
        <Alert variant="warning">
          Cảnh báo: COGS đang là <strong>{pnl.cogsPct.toFixed(1)}%</strong> doanh thu — vượt ngưỡng 40%. Kiểm tra lại công thức và giá nguyên liệu.
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Doanh thu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display text-cocoa">
              <CurrencyDisplay cents={pnl.revenue} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Giá vốn (COGS)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display text-cocoa">
              <CurrencyDisplay cents={pnl.cogs} />
            </p>
            <p className={`text-xs mt-1 ${cogsAlert ? 'text-destructive' : 'text-emerald-700'}`}>
              {pnl.cogsPct.toFixed(1)}% / Doanh thu
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Chi phí khác</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display text-cocoa">
              <CurrencyDisplay cents={totalExp} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lãi ròng</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-display ${pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-destructive'}`}>
              <CurrencyDisplay cents={pnl.netProfit} />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{pct(pnl.netProfit, pnl.revenue)}% biên</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Phân bổ doanh thu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span>Giá vốn</span>
                <span className="text-muted-foreground">{pnl.cogsPct.toFixed(1)}%</span>
              </div>
              <Progress value={pnl.cogsPct} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Chi phí</span>
                <span className="text-muted-foreground">{pct(totalExp, pnl.revenue)}%</span>
              </div>
              <Progress value={pct(totalExp, pnl.revenue)} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Lãi ròng</span>
                <span className="text-muted-foreground">{pct(pnl.netProfit, pnl.revenue)}%</span>
              </div>
              <Progress value={Math.max(0, pct(pnl.netProfit, pnl.revenue))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chi phí theo loại</CardTitle>
          </CardHeader>
          <CardContent>
            {pnl.expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa ghi nhận chi phí nào trong kỳ này.</p>
            ) : (
              <ul className="divide-y text-sm">
                {pnl.expensesByCategory.map((e) => (
                  <li key={e.category} className="flex justify-between py-2">
                    <span>{EXPENSE_LABEL[e.category] ?? e.category}</span>
                    <CurrencyDisplay cents={e.total} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
