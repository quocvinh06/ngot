"""Orders module — create, confirm, status transitions, bills, VietQR."""
from __future__ import annotations

import io
from datetime import datetime
from decimal import Decimal
from typing import Optional

import pandas as pd

from lib import sheets_client
from lib.audit import log_action
from lib.format_vi import format_date_vi, format_vnd, round_vnd
from lib.models import Order, OrderItem
from lib.modules import inventory as inv_mod


_STATUS_FLOW = {
    "draft": ["confirmed", "cancelled"],
    "confirmed": ["in_progress", "cancelled"],
    "in_progress": ["ready", "cancelled"],
    "ready": ["delivered", "cancelled"],
    "delivered": [],
    "cancelled": [],
}


def list_orders() -> pd.DataFrame:
    return sheets_client.read_tab("Orders")


def get(order_id: int) -> Optional[Order]:
    df = list_orders()
    if df.empty:
        return None
    matches = df[pd.to_numeric(df["id"], errors="coerce") == int(order_id)]
    if matches.empty:
        return None
    return Order.from_row(matches.iloc[0])


def list_items(order_id: int) -> list[OrderItem]:
    df = sheets_client.read_tab("OrderItems")
    if df.empty or "order_id" not in df.columns:
        return []
    matches = df[pd.to_numeric(df["order_id"], errors="coerce") == int(order_id)]
    return [OrderItem.from_row(r) for _, r in matches.iterrows()]


def _compute_totals(items: list[dict], discount_kind: str, discount_value: float) -> tuple[int, int]:
    subtotal = sum(int(float(i.get("unit_price_vnd", 0))) * int(i.get("quantity", 0)) for i in items)
    if discount_kind == "pct" and discount_value:
        total = subtotal * (1 - float(discount_value) / 100.0)
    elif discount_kind == "fixed" and discount_value:
        total = subtotal - float(discount_value)
    else:
        total = subtotal
    if total < 0:
        total = 0
    return int(subtotal), round_vnd(total)


def create_order(
    *,
    customer_id: int,
    items: list[dict],
    delivery_date: Optional[datetime] = None,
    delivery_address: str = "",
    discount_kind: str = "none",
    discount_value: float = 0,
    campaign_id: Optional[int] = None,
    notes: str = "",
    source: str = "manual",
    actor_role: str = "staff",
    status: str = "draft",
) -> Order:
    """Create an Order + OrderItems. Status defaults to draft (no inventory consume).

    items = [{dish_id, dish_name_snapshot, quantity, unit_price_vnd, notes}, ...]
    """
    if not items:
        raise ValueError("Order requires at least one item.")
    subtotal, total = _compute_totals(items, discount_kind, discount_value)
    now = datetime.now()
    order = Order(
        customer_id=customer_id,
        status=status,
        order_date=now,
        delivery_date=delivery_date or now,
        delivery_address=delivery_address or None,
        subtotal_vnd=Decimal(subtotal),
        discount_kind=discount_kind,
        discount_value=Decimal(str(discount_value)) if discount_value else None,
        campaign_id=campaign_id,
        total_vnd=Decimal(total),
        source=source,
        confirmed_at=now if status == "confirmed" else None,
        created_by=actor_role,
    )
    order_id = sheets_client.append_row("Orders", order.to_row())
    order.id = order_id
    item_rows = []
    for it in items:
        oi = OrderItem(
            order_id=order_id,
            dish_id=int(it["dish_id"]),
            dish_name_snapshot=str(it.get("dish_name_snapshot") or ""),
            quantity=int(it["quantity"]),
            unit_price_vnd=Decimal(str(it["unit_price_vnd"])),
            subtotal_vnd=Decimal(str(it["unit_price_vnd"])) * int(it["quantity"]),
            notes=it.get("notes") or None,
        )
        item_rows.append(oi.to_row())
    sheets_client.append_rows("OrderItems", item_rows)
    log_action(
        actor_role,
        "order.create",
        target_kind="Order",
        target_id=order_id,
        diff={"item_count": len(items), "total_vnd": total, "status": status},
    )
    if status == "confirmed":
        inv_mod.consume_for_order(order_id, actor_role=actor_role)
    return order


def confirm_order(order_id: int, actor_role: str = "staff") -> bool:
    return _set_status(order_id, "confirmed", actor_role, do_consume=True)


def _set_status(order_id: int, new_status: str, actor_role: str, do_consume: bool = False) -> bool:
    o = get(order_id)
    if o is None:
        return False
    allowed = _STATUS_FLOW.get(o.status, [])
    if new_status not in allowed and new_status != o.status:
        # allow no-op
        return False
    patch = {"status": new_status}
    if new_status == "confirmed":
        patch["confirmed_at"] = datetime.now().isoformat(timespec="seconds")
    sheets_client.update_row("Orders", order_id, patch)
    log_action(
        actor_role,
        f"order.{new_status}",
        target_kind="Order",
        target_id=order_id,
        diff={"prev": o.status, "next": new_status},
    )
    if new_status == "confirmed" and do_consume:
        inv_mod.consume_for_order(order_id, actor_role=actor_role)
    return True


def transition_status(order_id: int, new_status: str, actor_role: str = "staff") -> bool:
    return _set_status(order_id, new_status, actor_role, do_consume=(new_status == "confirmed"))


def mark_paid(order_id: int, payment_method: str = "vietqr", actor_role: str = "staff") -> bool:
    patch = {
        "paid_at": datetime.now().isoformat(timespec="seconds"),
        "payment_method": payment_method,
    }
    sheets_client.update_row("Orders", order_id, patch)
    log_action(
        actor_role,
        "order.mark_paid",
        target_kind="Order",
        target_id=order_id,
        diff={"payment_method": payment_method},
    )
    return True


# ---------- VietQR ----------


def _crc16_ccitt(data: bytes, poly: int = 0x1021, init: int = 0xFFFF) -> int:
    crc = init
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ poly
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc


def _tlv(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def vietqr_payload(
    bank_bin: str, account_number: str, amount: int, memo: str = ""
) -> str:
    """Build a NAPAS VietQR payload string (basic structure).

    bank_bin is the 6-digit BIN of the receiving bank (e.g., 970422 for MB Bank).
    """
    payload = ""
    payload += _tlv("00", "01")  # Payload Format Indicator
    payload += _tlv("01", "12")  # Point of Initiation Method (12 = dynamic)
    # 38 = Merchant Account Information (NAPAS specific)
    napas = ""
    napas += _tlv("00", "A000000727")  # AID
    inner = _tlv("00", bank_bin) + _tlv("01", account_number)
    napas += _tlv("01", inner)
    napas += _tlv("02", "QRIBFTTA")  # service code
    payload += _tlv("38", napas)
    payload += _tlv("53", "704")  # currency: VND
    if amount and amount > 0:
        payload += _tlv("54", str(int(amount)))
    payload += _tlv("58", "VN")
    if memo:
        addn = _tlv("08", memo[:25])
        payload += _tlv("62", addn)
    payload += "6304"  # CRC tag, length placeholder
    crc = _crc16_ccitt(payload.encode("utf-8"))
    payload += f"{crc:04X}"
    return payload


def generate_vietqr(order_id: int, settings: dict) -> bytes:
    """Return PNG bytes of a VietQR code for an order."""
    import qrcode

    o = get(order_id)
    if o is None:
        raise ValueError(f"Order {order_id} not found")
    bank_bin = settings.get("bank_bin", "970422")  # default = MB Bank for demo
    account = settings.get("bank_account_number", "0000000000")
    payload = vietqr_payload(
        bank_bin=bank_bin,
        account_number=account,
        amount=int(o.total_vnd or 0),
        memo=f"Thanh toan don NGOT-{order_id}",
    )
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------- Bill PDF ----------


def generate_bill_text(order_id: int, settings: dict, customer_row: Optional[dict] = None) -> str:
    """Render a plain-text bill (UTF-8) — works on any platform, no font issues.

    Returned string is suitable for `st.download_button` (.txt) or `st.code()`
    rendering on the Order Detail page.
    """
    o = get(order_id)
    if o is None:
        raise ValueError(f"Order {order_id} not found")
    items = list_items(order_id)

    shop_name = settings.get("shop_name") or "Ngọt"
    shop_address = settings.get("shop_address", "")
    shop_phone = settings.get("shop_phone", "")
    cert = settings.get("shop_food_safety_cert", "")
    bank_name = settings.get("bank_name", "")
    bank_acct = settings.get("bank_account_number", "")
    bank_holder = settings.get("bank_account_holder", "")

    W = 56  # printable width (chars), suits an A6 thermal-receipt feel
    sep = "═" * W
    thin = "─" * W

    lines: list[str] = []
    lines.append(sep)
    lines.append(shop_name.upper().center(W))
    if shop_address:
        lines.append(shop_address.center(W))
    if shop_phone:
        lines.append(f"ĐT: {shop_phone}".center(W))
    if cert:
        lines.append(f"GCN ATTP: {cert}".center(W))
    lines.append(sep)
    lines.append("")

    lines.append(f"HOÁ ĐƠN #{order_id}".center(W))
    lines.append(thin)
    lines.append(f"Ngày đặt:  {format_date_vi(o.order_date)}")
    lines.append(f"Ngày giao: {format_date_vi(o.delivery_date)}")
    lines.append("")

    if customer_row:
        cname = (customer_row.get("name") or "").strip()
        cphone = (customer_row.get("phone") or "").strip()
        if cname:
            lines.append(f"Khách hàng:    {cname}")
        if cphone:
            lines.append(f"Số điện thoại: {cphone}")
    if o.delivery_address:
        lines.append(f"Địa chỉ giao:  {o.delivery_address}")
    if o.notes:
        lines.append(f"Ghi chú:       {o.notes}")
    lines.append("")

    lines.append(thin)
    lines.append("CHI TIẾT ĐƠN")
    lines.append(thin)
    # Header row
    name_w = 26
    qty_w = 4
    price_w = 11
    total_w = 11
    lines.append(
        f"{'Món':<{name_w}}{'SL':>{qty_w}}{'Đơn giá':>{price_w}}{'Tổng':>{total_w}}"
    )
    lines.append("-" * (name_w + qty_w + price_w + total_w))
    for it in items:
        name = (it.dish_name_snapshot or "")[:name_w]
        qty = str(int(it.quantity or 0))
        unit = format_vnd(it.unit_price_vnd, with_symbol=False)
        sub = format_vnd(it.subtotal_vnd, with_symbol=False)
        if len(name) > name_w:
            # wrap long names — first slice on header row, rest indented
            lines.append(
                f"{name[:name_w]:<{name_w}}{qty:>{qty_w}}{unit:>{price_w}}{sub:>{total_w}}"
            )
        else:
            lines.append(
                f"{name:<{name_w}}{qty:>{qty_w}}{unit:>{price_w}}{sub:>{total_w}}"
            )
    lines.append(thin)

    # Totals
    sub_str = format_vnd(o.subtotal_vnd, with_symbol=False)
    lines.append(f"{'Tạm tính:':>{name_w + qty_w + price_w}} {sub_str:>{total_w - 1}}")
    if o.discount_value:
        if o.discount_kind == "pct":
            label = f"Giảm {o.discount_value}%:"
        else:
            label = f"Giảm {format_vnd(o.discount_value, with_symbol=False)}:"
        diff = int(o.subtotal_vnd or 0) - int(o.total_vnd or 0)
        lines.append(
            f"{label:>{name_w + qty_w + price_w}} {('-' + format_vnd(diff, with_symbol=False)):>{total_w - 1}}"
        )
    total_str = format_vnd(o.total_vnd, with_symbol=False)
    lines.append(f"{'TỔNG CỘNG:':>{name_w + qty_w + price_w}} {(total_str + ' đ'):>{total_w - 1}}")
    lines.append("")

    # Payment block
    lines.append(thin)
    lines.append("THANH TOÁN")
    lines.append(thin)
    lines.append(f"Ngân hàng:     {bank_name or '(chưa thiết lập)'}")
    lines.append(f"Số tài khoản:  {bank_acct or '(chưa thiết lập)'}")
    lines.append(f"Chủ tài khoản: {bank_holder or '(chưa thiết lập)'}")
    lines.append(f"Nội dung CK:   Thanh toan don NGOT-{order_id}")
    if o.paid_at:
        lines.append(f"Đã thanh toán: {o.paid_at}")
    if o.payment_method:
        lines.append(f"Phương thức:   {o.payment_method}")
    lines.append("")

    lines.append(sep)
    lines.append("Cảm ơn quý khách!".center(W))
    lines.append("Hẹn gặp lại tại Ngọt 🍰".center(W))
    lines.append(sep)

    return "\n".join(lines)


def generate_bill_pdf(order_id: int, settings: dict, customer_row: Optional[dict] = None) -> bytes:
    """DEPRECATED — use generate_bill_text. Kept for backward compat; falls
    through to text-as-bytes so existing callers don't crash. PDF generation
    via fpdf2 broke on Vietnamese diacritics outside Helvetica's range."""
    return generate_bill_text(order_id, settings, customer_row).encode("utf-8")


def _generate_bill_pdf_legacy(order_id: int, settings: dict, customer_row: Optional[dict] = None) -> bytes:
    """Original fpdf2 implementation — kept for reference, not invoked.

    Uses DejaVu Sans (bundled with fpdf2) for Vietnamese diacritics.
    """
    from fpdf import FPDF

    o = get(order_id)
    if o is None:
        raise ValueError(f"Order {order_id} not found")
    items = list_items(order_id)

    pdf = FPDF(orientation="P", unit="mm", format="A5")
    pdf.add_page()
    # Try to use a Unicode font; fallback to Helvetica if unavailable
    try:
        # fpdf2 ships DejaVu in `fpdf/font/`; if not findable we use core font
        pdf.add_font("DejaVu", "", _resolve_dejavu(), uni=True)
        pdf.set_font("DejaVu", size=12)
        font = "DejaVu"
    except Exception:
        pdf.set_font("Helvetica", size=12)
        font = "Helvetica"

    shop_name = settings.get("shop_name") or "Ngọt"
    shop_address = settings.get("shop_address", "")
    shop_phone = settings.get("shop_phone", "")
    cert = settings.get("shop_food_safety_cert", "")

    pdf.set_font(font, "B", 16)
    pdf.cell(0, 8, txt=_safe(f"{shop_name} — Hoá đơn"), ln=True, align="C")
    pdf.set_font(font, size=9)
    if shop_address:
        pdf.cell(0, 5, txt=_safe(shop_address), ln=True, align="C")
    if shop_phone:
        pdf.cell(0, 5, txt=_safe(f"ĐT: {shop_phone}"), ln=True, align="C")
    if cert:
        pdf.cell(0, 5, txt=_safe(f"GCN ATTP: {cert}"), ln=True, align="C")
    pdf.ln(2)

    pdf.set_font(font, "B", 10)
    pdf.cell(0, 6, txt=_safe(f"Đơn #{order_id}"), ln=True)
    pdf.set_font(font, size=10)
    pdf.cell(0, 5, txt=_safe(f"Ngày: {format_date_vi(o.order_date)}"), ln=True)
    pdf.cell(0, 5, txt=_safe(f"Giao: {format_date_vi(o.delivery_date)}"), ln=True)
    if customer_row:
        pdf.cell(0, 5, txt=_safe(f"Khách: {customer_row.get('name', '')}"), ln=True)
        if customer_row.get("phone"):
            pdf.cell(0, 5, txt=_safe(f"SĐT: {customer_row['phone']}"), ln=True)
    if o.delivery_address:
        pdf.multi_cell(0, 5, txt=_safe(f"Địa chỉ: {o.delivery_address}"))
    pdf.ln(2)

    # Line items
    pdf.set_font(font, "B", 10)
    pdf.cell(70, 6, txt=_safe("Món"), border=1)
    pdf.cell(15, 6, txt=_safe("SL"), border=1, align="C")
    pdf.cell(30, 6, txt=_safe("Đơn giá"), border=1, align="R")
    pdf.cell(30, 6, txt=_safe("Tổng"), border=1, ln=True, align="R")
    pdf.set_font(font, size=9)
    for it in items:
        pdf.cell(70, 6, txt=_safe(it.dish_name_snapshot or ""), border=1)
        pdf.cell(15, 6, txt=str(it.quantity), border=1, align="C")
        pdf.cell(30, 6, txt=format_vnd(it.unit_price_vnd, with_symbol=False), border=1, align="R")
        pdf.cell(30, 6, txt=format_vnd(it.subtotal_vnd, with_symbol=False), border=1, ln=True, align="R")

    pdf.ln(2)
    pdf.set_font(font, size=10)
    pdf.cell(115, 5, txt=_safe("Tạm tính:"), align="R")
    pdf.cell(30, 5, txt=format_vnd(o.subtotal_vnd, with_symbol=False), ln=True, align="R")
    if o.discount_value:
        label = (
            f"Giảm {o.discount_value}%"
            if o.discount_kind == "pct"
            else f"Giảm {format_vnd(o.discount_value, with_symbol=False)}"
        )
        pdf.cell(115, 5, txt=_safe(f"{label}:"), align="R")
        diff = int(o.subtotal_vnd or 0) - int(o.total_vnd or 0)
        pdf.cell(30, 5, txt=f"-{format_vnd(diff, with_symbol=False)}", ln=True, align="R")
    pdf.set_font(font, "B", 11)
    pdf.cell(115, 7, txt=_safe("Tổng cộng:"), align="R")
    pdf.cell(30, 7, txt=format_vnd(o.total_vnd, with_symbol=True), ln=True, align="R")

    # Payment block
    pdf.ln(3)
    pdf.set_font(font, "B", 10)
    pdf.cell(0, 6, txt=_safe("Thanh toán — Chuyển khoản:"), ln=True)
    pdf.set_font(font, size=9)
    bank = settings.get("bank_name", "")
    acct = settings.get("bank_account_number", "")
    holder = settings.get("bank_account_holder", "")
    if bank:
        pdf.cell(0, 5, txt=_safe(f"Ngân hàng: {bank}"), ln=True)
    if acct:
        pdf.cell(0, 5, txt=_safe(f"Số TK: {acct}"), ln=True)
    if holder:
        pdf.cell(0, 5, txt=_safe(f"Chủ TK: {holder}"), ln=True)
    pdf.cell(0, 5, txt=_safe(f"Nội dung: Thanh toan don NGOT-{order_id}"), ln=True)
    pdf.ln(2)
    pdf.set_font(font, "I", 9)
    pdf.cell(0, 5, txt=_safe("Cảm ơn quý khách. Hẹn gặp lại!"), ln=True, align="C")

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1", errors="replace")
    return bytes(out)


def _safe(s: str) -> str:
    """Return string for PDF cells; passthrough."""
    return "" if s is None else str(s)


def _resolve_dejavu() -> str:
    """Best-effort path to a Unicode TTF. Falls back to a system font."""
    import os
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("No Unicode TTF found")


def settings_dict() -> dict:
    """Convenience: read Settings tab into a flat dict."""
    df = sheets_client.read_tab("Settings")
    if df.empty:
        return {}
    out = {}
    for _, row in df.iterrows():
        k = str(row.get("key", "")).strip()
        v = row.get("value")
        if k:
            out[k] = "" if v is None else str(v)
    return out
