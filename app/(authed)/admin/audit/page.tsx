import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listAudit, listSheetSync, listTelegramAlerts } from '@/lib/queries/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateDisplay } from '@/components/date-display';

export const metadata = { title: 'Nhật ký kiểm toán — Ngọt' };

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (session.user.role !== 'owner') redirect('/staff');

  const [audit, telegram, sheets] = await Promise.all([
    listAudit(),
    listTelegramAlerts(),
    listSheetSync(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhật ký kiểm toán"
        description="Toàn bộ thao tác mutating, cảnh báo Telegram, và đồng bộ Google Sheets."
      />
      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Hoạt động ({audit.length})</TabsTrigger>
          <TabsTrigger value="telegram">Telegram ({telegram.length})</TabsTrigger>
          <TabsTrigger value="sheets">Google Sheets ({sheets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <DateDisplay date={a.createdAt} />
                      </TableCell>
                      <TableCell>{a.actorName ?? a.actorEmail ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.action}</Badge>
                      </TableCell>
                      <TableCell>
                        {a.entity}
                        {a.entityId ? ` #${a.entityId}` : ''}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.ipAddress ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Lỗi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {telegram.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <DateDisplay date={t.sentAt} />
                      </TableCell>
                      <TableCell>{t.kind}</TableCell>
                      <TableCell>
                        {t.succeeded ? <Badge variant="success">OK</Badge> : <Badge variant="destructive">Lỗi</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {t.errorMsg ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheets">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Tab</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheets.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <DateDisplay date={s.syncedAt} />
                      </TableCell>
                      <TableCell>
                        {s.entity} #{s.entityId}
                      </TableCell>
                      <TableCell>{s.action}</TableCell>
                      <TableCell>{s.sheetTab}</TableCell>
                      <TableCell>
                        {s.succeeded ? <Badge variant="success">OK</Badge> : <Badge variant="destructive">Lỗi</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
