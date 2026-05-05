import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  LayoutDashboard,
  ShoppingBag,
  Cookie,
  Boxes,
  Users,
  Megaphone,
  Wallet,
  Settings,
  Activity,
} from 'lucide-react';

const ICONS = {
  admin: LayoutDashboard,
  staff: LayoutDashboard,
  orders: ShoppingBag,
  menu: Cookie,
  inventory: Boxes,
  customers: Users,
  campaigns: Megaphone,
  finance: Wallet,
  settings: Settings,
  audit: Activity,
} as const;

type Section = { href: string; key: keyof typeof ICONS };

const OWNER: Section[] = [
  { href: '/admin', key: 'admin' },
  { href: '/orders', key: 'orders' },
  { href: '/menu', key: 'menu' },
  { href: '/inventory', key: 'inventory' },
  { href: '/customers', key: 'customers' },
  { href: '/campaigns', key: 'campaigns' },
  { href: '/finance/pnl', key: 'finance' },
  { href: '/settings', key: 'settings' },
  { href: '/admin/audit', key: 'audit' },
];

const STAFF: Section[] = [
  { href: '/staff', key: 'staff' },
  { href: '/orders', key: 'orders' },
  { href: '/menu', key: 'menu' },
  { href: '/inventory', key: 'inventory' },
  { href: '/customers', key: 'customers' },
];

export async function AppSidebar({ role }: { role: 'owner' | 'staff' }) {
  const t = await getTranslations('nav');
  const items = role === 'owner' ? OWNER : STAFF;
  return (
    <aside className="hidden lg:flex w-56 shrink-0 border-r bg-cream/30 flex-col py-4">
      <nav className="flex-1 px-2 space-y-0.5">
        {items.map((s) => {
          const Icon = ICONS[s.key];
          return (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-background"
            >
              <Icon className="h-4 w-4" />
              {t(s.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
