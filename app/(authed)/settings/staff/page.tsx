import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateDisplay } from '@/components/date-display';
import { createStaffUser } from '@/lib/actions/staff';

export default async function SettingsStaffPage() {
  const session = await auth();
  if (session?.user?.role !== 'owner') redirect('/staff');
  const list = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt));
  return (
    <div className="space-y-6">
      <PageHeader title="Nhân viên" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Thêm nhân viên</h3>
            <form action={createStaffUser} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Họ tên</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu (≥ 8 ký tự)</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Vai trò</Label>
                <Select id="role" name="role" required defaultValue="staff">
                  <option value="staff">Nhân viên</option>
                  <option value="owner">Chủ cửa hàng</option>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Tạo
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
                  <TableHead>Email</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell>
                      {u.role === 'owner' ? <Badge>Chủ</Badge> : <Badge variant="outline">Nhân viên</Badge>}
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={u.createdAt} fmt="dd/MM/yy" />
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
