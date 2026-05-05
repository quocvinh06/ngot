import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listSuppliers } from '@/lib/queries/inventory';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createSupplier } from '@/lib/actions/inventory';

export default async function SuppliersPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/inventory');
  const sups = await listSuppliers();
  return (
    <div className="space-y-6">
      <PageHeader title="Nhà cung cấp" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Thêm nhà cung cấp</h3>
            <form action={createSupplier} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Tên</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">SĐT</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Textarea id="address" name="address" rows={2} />
              </div>
              <Button type="submit" className="w-full">
                Thêm
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sups.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/inventory/suppliers/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.phone ?? '—'}</TableCell>
                    <TableCell>{s.email ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
