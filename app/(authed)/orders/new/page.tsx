import Link from 'next/link';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { isNull, desc } from 'drizzle-orm';
import { listMenuItems, listCategories } from '@/lib/queries/menu';
import { activeCampaigns } from '@/lib/queries/campaigns';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderWizard } from './order-wizard';

export const metadata = { title: 'Đơn mới — Ngọt' };

export default async function NewOrderPage() {
  const [menu, cats, custs, camps] = await Promise.all([
    listMenuItems(),
    listCategories(),
    db
      .select({ id: customers.id, name: customers.name, phone: customers.phone })
      .from(customers)
      .where(isNull(customers.deletedAt))
      .orderBy(desc(customers.updatedAt))
      .limit(50),
    activeCampaigns(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng mới"
        actions={
          <Link href="/orders">
            <Button variant="outline">Hủy</Button>
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <OrderWizard
            menuItems={menu.filter((m) => m.active).map((m) => ({
              id: m.id,
              name: m.name,
              priceCents: m.priceCents,
              categoryId: m.categoryId,
              photoUrl: m.photoUrl,
            }))}
            categories={cats.filter((c) => c.active)}
            customers={custs}
            campaigns={camps.map((c) => ({ id: c.id, name: c.name, type: c.type, value: c.value }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
