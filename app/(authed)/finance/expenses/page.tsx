import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listExpenses } from '@/lib/queries/finance';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CurrencyDisplay } from '@/components/currency-display';

const LABEL: Record<string, string> = {
  rent: 'Mặt bằng',
  utilities: 'Điện nước',
  labor: 'Lương',
  packaging: 'Bao bì',
  marketing: 'Marketing',
  ingredients_other: 'Nguyên liệu khác',
  other: 'Khác',
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  const sp = await searchParams;
  const list = await listExpenses(sp.category);
  const total = list.reduce((a, e) => a + e.amountCents, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chi phí"
        description={`Tổng: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(total)}`}
        actions={
          <Link href="/finance/expenses/new">
            <Button>+ Chi phí mới</Button>
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chưa ghi nhận chi phí nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{LABEL[e.category] ?? e.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.description ?? ''}</TableCell>
                    <TableCell className="text-right font-medium">
                      <CurrencyDisplay cents={e.amountCents} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
