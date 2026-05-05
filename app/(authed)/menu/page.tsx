import Link from 'next/link';
import { auth } from '@/auth';
import { listMenuItems, listCategories } from '@/lib/queries/menu';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurrencyDisplay } from '@/components/currency-display';
import { TopicalImage } from '@/components/topical-image';
import { pct } from '@/lib/utils';

export const metadata = { title: 'Thực đơn — Ngọt' };

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const sp = await searchParams;
  const categoryId = sp.categoryId ? Number(sp.categoryId) : undefined;
  const session = await auth();
  const isOwner = session?.user?.role === 'owner';

  const [items, cats] = await Promise.all([listMenuItems(categoryId), listCategories()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thực đơn"
        actions={
          isOwner ? (
            <div className="flex gap-2">
              <Link href="/menu/categories">
                <Button variant="outline">Danh mục</Button>
              </Link>
              <Link href="/menu/new">
                <Button>+ Món mới</Button>
              </Link>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/menu"
          className={`text-xs px-3 py-1 rounded-full border ${!categoryId ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
        >
          Tất cả
        </Link>
        {cats.map((c) => (
          <Link
            key={c.id}
            href={`/menu?categoryId=${c.id}`}
            className={`text-xs px-3 py-1 rounded-full border ${categoryId === c.id ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Chưa có món nào — thêm món đầu tiên để khách đặt hàng.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((m) => {
            const margin = m.priceCents - m.cogsSnapshotCents;
            const marginPct = pct(margin, m.priceCents);
            return (
              <Card key={m.id}>
                <Link href={`/menu/${m.id}`}>
                  <TopicalImage
                    src={m.photoUrl}
                    seed={`menu-${m.slug}`}
                    entityName="MenuItem"
                    alt={m.name}
                    width={400}
                    height={280}
                    className="w-full h-44 rounded-t-lg"
                  />
                </Link>
                <CardContent className="p-3 space-y-1">
                  <Link href={`/menu/${m.id}`} className="text-sm font-medium hover:underline line-clamp-2 min-h-10 block">
                    {m.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{m.categoryName}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      <CurrencyDisplay cents={m.priceCents} />
                    </span>
                    {m.cogsSnapshotCents > 0 && (
                      <Badge variant={marginPct > 60 ? 'success' : marginPct > 40 ? 'warning' : 'destructive'}>
                        {marginPct}%
                      </Badge>
                    )}
                  </div>
                  {!m.active && (
                    <Badge variant="outline" className="text-xs">
                      Tạm ngưng
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
