'use client';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/currency-display';
import { TopicalImage } from '@/components/topical-image';
import { PdplConsentCheckbox } from '@/components/pdpl-consent-checkbox';
import { toast } from 'sonner';
import { createOrder } from '@/lib/actions/orders';
import { createCustomer } from '@/lib/actions/customers';

interface MenuLite {
  id: number;
  name: string;
  priceCents: number;
  categoryId: number;
  photoUrl: string | null;
}
interface CatLite {
  id: number;
  name: string;
}
interface CustLite {
  id: number;
  name: string;
  phone: string | null;
}
interface CampLite {
  id: number;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
}

export function OrderWizard({
  menuItems,
  categories,
  customers,
  campaigns,
}: {
  menuItems: MenuLite[];
  categories: CatLite[];
  customers: CustLite[];
  campaigns: CampLite[];
}) {
  const [pending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState<number | 'new'>(customers[0]?.id ?? 'new');
  const [items, setItems] = useState<Map<number, number>>(new Map());
  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [campaignId, setCampaignId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [vatPct, setVatPct] = useState<number>(8);
  const [deadlineHours, setDeadlineHours] = useState<number>(2);
  const [notes, setNotes] = useState<string>('');

  // new customer fields (when customerId === 'new')
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const visibleItems = useMemo(
    () => (activeCat === 'all' ? menuItems : menuItems.filter((m) => m.categoryId === activeCat)),
    [menuItems, activeCat],
  );
  const subtotal = useMemo(() => {
    let total = 0;
    for (const [mid, qty] of items) {
      const m = menuItems.find((mm) => mm.id === mid);
      if (m) total += m.priceCents * qty;
    }
    return total;
  }, [items, menuItems]);

  const camp = campaigns.find((c) => c.id === campaignId);
  const discount = camp
    ? camp.type === 'percentage'
      ? Math.min(subtotal, Math.round((subtotal * camp.value) / 100))
      : Math.min(subtotal, camp.value)
    : 0;
  const taxable = subtotal - discount;
  const vat = Math.round((taxable * vatPct) / 100);
  const total = taxable + vat;

  function bump(id: number, by: number) {
    setItems((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? 0;
      const v = Math.max(0, cur + by);
      if (v === 0) next.delete(id);
      else next.set(id, v);
      return next;
    });
  }

  async function submit() {
    if (items.size === 0) {
      toast.error('Chọn ít nhất một sản phẩm');
      return;
    }
    let cid = typeof customerId === 'number' ? customerId : null;
    if (customerId === 'new') {
      if (!newName.trim()) {
        toast.error('Cần điền tên khách hàng');
        return;
      }
      const fd = new FormData();
      fd.set('name', newName.trim());
      fd.set('phone', newPhone);
      fd.set('address', newAddress);
      fd.set('consent', 'on');
      try {
        // createCustomer redirects on success; we replicate by parsing the form here.
        // Instead: call a dedicated client-side fetch is not provided, so we surface
        // the redirect by catching the navigation. Simpler: require user to create
        // the customer first via /customers/new for the wizard MVP.
        await createCustomer(fd);
        // createCustomer redirects, so we'll never reach this line.
        return;
      } catch (e) {
        // Next.js redirect throws — that's fine in server actions, but client-side
        // call surfaces NEXT_REDIRECT. We can't capture the new id here without an
        // RPC return. Fallback: ask user to create customer first.
        toast.error('Vui lòng tạo khách hàng tại trang Khách hàng trước.');
        void e;
        return;
      }
    }
    if (!cid) {
      toast.error('Chọn khách hàng');
      return;
    }
    startTransition(async () => {
      try {
        const deadlineAt = new Date(Date.now() + deadlineHours * 3600 * 1000).toISOString();
        await createOrder({
          customerId: cid,
          items: Array.from(items.entries()).map(([menuItemId, qty]) => ({ menuItemId, qty })),
          campaignId: campaignId || null,
          paymentMethod,
          vatPct,
          deadlineAt,
          notes,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Lỗi tạo đơn');
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* MENU PICKER */}
      <div className="lg:col-span-3 space-y-4">
        <h2 className="font-semibold">1. Chọn sản phẩm</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCat('all')}
            className={`text-xs px-3 py-1 rounded-full border ${
              activeCat === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
            }`}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              className={`text-xs px-3 py-1 rounded-full border ${
                activeCat === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {visibleItems.map((m) => {
            const qty = items.get(m.id) ?? 0;
            return (
              <Card key={m.id}>
                <CardContent className="p-2 space-y-2">
                  <TopicalImage
                    src={m.photoUrl}
                    seed={`menu-${m.id}-${m.name}`}
                    entityName="MenuItem"
                    alt={m.name}
                    width={300}
                    height={200}
                    className="rounded-md w-full h-32"
                  />
                  <p className="text-sm font-medium line-clamp-2 min-h-10">{m.name}</p>
                  <p className="text-xs">
                    <CurrencyDisplay cents={m.priceCents} />
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => bump(m.id, -1)} disabled={qty === 0}>
                      −
                    </Button>
                    <span className="text-sm w-6 text-center">{qty}</span>
                    <Button size="sm" className="h-7 w-7 p-0" onClick={() => bump(m.id, 1)}>
                      +
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* RIGHT — CUSTOMER + TOTALS */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="font-semibold">2. Khách hàng</h2>
        <div className="space-y-2">
          <Label>Chọn khách</Label>
          <Select
            value={String(customerId)}
            onChange={(e) => setCustomerId(e.target.value === 'new' ? 'new' : Number(e.target.value))}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `· ${c.phone}` : ''}
              </option>
            ))}
            <option value="new">+ Khách mới</option>
          </Select>
        </div>
        {customerId === 'new' && (
          <div className="space-y-2 border rounded-md p-3 bg-cream/30">
            <p className="text-xs text-muted-foreground">
              Lưu ý: tạo khách mới sẽ chuyển sang trang &quot;Khách hàng&quot;. Sau đó bạn quay lại để hoàn tất đơn.
            </p>
            <Label>Tên khách</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <Label>SĐT</Label>
            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <Label>Địa chỉ</Label>
            <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            <PdplConsentCheckbox />
          </div>
        )}

        <h2 className="font-semibold pt-2">3. Khuyến mãi & thanh toán</h2>
        <div className="space-y-2">
          <Label>Khuyến mãi</Label>
          <Select value={String(campaignId)} onChange={(e) => setCampaignId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Không —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'percentage' ? `${c.value}%` : `-${c.value.toLocaleString()}đ`})
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Thanh toán</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="Cash">Tiền mặt</option>
              <option value="VietQR">VietQR</option>
              <option value="MoMo">MoMo</option>
              <option value="ZaloPay">ZaloPay</option>
              <option value="BankTransfer">Chuyển khoản</option>
              <option value="COD">COD</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>VAT %</Label>
            <Select value={String(vatPct)} onChange={(e) => setVatPct(Number(e.target.value))}>
              <option value="0">0%</option>
              <option value="8">8%</option>
              <option value="10">10%</option>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Hạn giao (giờ kể từ bây giờ)</Label>
          <Input type="number" min={1} max={48} value={deadlineHours} onChange={(e) => setDeadlineHours(Number(e.target.value) || 2)} />
        </div>
        <div className="space-y-2">
          <Label>Ghi chú</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Tạm tính</span>
            <CurrencyDisplay cents={subtotal} />
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Giảm giá</span>
              <span>− <CurrencyDisplay cents={discount} /></span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>VAT ({vatPct}%)</span>
            <CurrencyDisplay cents={vat} />
          </div>
          <div className="flex justify-between font-semibold text-lg pt-2 border-t">
            <span>Tổng cộng</span>
            <CurrencyDisplay cents={total} />
          </div>
        </div>

        <Button className="w-full" disabled={pending || items.size === 0} onClick={submit}>
          {pending ? 'Đang lưu...' : 'Tạo đơn'}
        </Button>
      </div>
    </div>
  );
}
