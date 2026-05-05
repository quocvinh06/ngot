import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listCategories } from '@/lib/queries/menu';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createCategory } from '@/lib/actions/menu';

export default async function CategoriesPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/menu');
  const cats = await listCategories();

  return (
    <div className="space-y-6">
      <PageHeader title="Danh mục thực đơn" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Thêm danh mục</h3>
            <form action={createCategory} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Tên</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Thứ tự</Label>
                <Input id="sortOrder" name="sortOrder" type="number" defaultValue={0} />
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
                  <TableHead>Slug</TableHead>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                    <TableCell>{c.sortOrder}</TableCell>
                    <TableCell>
                      {c.active ? <Badge variant="success">Đang dùng</Badge> : <Badge variant="outline">Ẩn</Badge>}
                    </TableCell>
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
