import Link from 'next/link';
import { listCustomers } from '@/lib/queries/customers';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CurrencyDisplay } from '@/components/currency-display';
import { DateDisplay } from '@/components/date-display';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Khách hàng — Ngọt' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const list = await listCustomers(sp.q, Number(sp.page ?? 1));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách hàng"
        actions={
          <Link href="/customers/new">
            <Button>+ Khách mới</Button>
          </Link>
        }
      />
      <form className="flex gap-2 max-w-md">
        <Input name="q" placeholder="Tìm theo tên, SĐT..." defaultValue={sp.q ?? ''} />
        <Button variant="outline" type="submit">
          Tìm
        </Button>
      </form>

      <Card>
        <CardContent className="pt-6">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chưa có khách hàng phù hợp.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead className="text-right">Tổng chi tiêu</TableHead>
                  <TableHead className="text-right">Số đơn</TableHead>
                  <TableHead>Cập nhật</TableHead>
                  <TableHead>PDPL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="hover:underline font-medium">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay cents={c.totalSpentCents} />
                    </TableCell>
                    <TableCell className="text-right">{c.orderCount}</TableCell>
                    <TableCell>
                      <DateDisplay date={c.updatedAt ?? c.createdAt} fmt="dd/MM/yy" />
                    </TableCell>
                    <TableCell>
                      {c.consentGivenAt ? (
                        <Badge variant="success">Đồng ý</Badge>
                      ) : (
                        <Badge variant="warning">Chưa</Badge>
                      )}
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
