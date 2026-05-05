import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getSupplierDetail } from '@/lib/queries/inventory';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/inventory');
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) notFound();
  const detail = await getSupplierDetail(sid);
  if (!detail) notFound();
  const { supplier, materials } = detail;
  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={supplier.phone ?? supplier.email ?? ''}
        actions={
          <Link href="/inventory/suppliers">
            <Button variant="outline">Quay lại</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin liên hệ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">SĐT: </span>
              {supplier.phone ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Email: </span>
              {supplier.email ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Địa chỉ: </span>
              {supplier.address ?? '—'}
            </p>
            {supplier.notes && <p className="text-muted-foreground">{supplier.notes}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nguyên liệu cung cấp ({materials.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa gắn nguyên liệu nào.</p>
            ) : (
              <ul className="divide-y">
                {materials.map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between text-sm">
                    <Link href={`/inventory/${m.id}`} className="hover:underline">
                      {m.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {Number(m.qtyOnHand).toFixed(2)} {m.unit}
                    </span>
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
