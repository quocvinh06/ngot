"""New Order form."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import pandas as pd
import streamlit as st

from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd, round_vnd
from lib.i18n import t
from lib.modules import customers as cust_mod
from lib.modules import menu as menu_mod
from lib.modules import orders as ord_mod

st.set_page_config(page_title="Đơn mới — Ngọt", page_icon="➕", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()

st.title(t("nav.new_order"))
st.caption("Khách → Món → Giao hàng → Khuyến mãi → Lưu / Xác nhận")

# Pre-fill from Telegram parse if any
prefill = st.session_state.get("prefill_order") or {}

# ---------- Customer block ----------
st.subheader("1. Khách hàng")
ccol1, ccol2 = st.columns([2, 1])
with ccol1:
    phone_input = st.text_input(
        "Số điện thoại khách",
        value=prefill.get("phone", ""),
        placeholder="09xxxxxxxx",
        key="phone_input",
    )
    found_customer = None
    if phone_input:
        found_customer = cust_mod.find_by_phone(phone_input)
        if found_customer:
            st.success(f"✓ Đã tìm thấy: **{found_customer.name}** — {found_customer.default_address or '(không có địa chỉ)'}")
        else:
            st.info("Khách mới — vui lòng nhập thông tin bên dưới.")
with ccol2:
    if found_customer:
        customer_id = found_customer.id
        st.metric("Khách hiện có", f"#{customer_id}")
    else:
        customer_id = None

if not found_customer and phone_input:
    with st.expander("Tạo khách mới", expanded=True):
        new_name = st.text_input("Tên khách", value=prefill.get("name", ""))
        new_addr = st.text_area("Địa chỉ giao", value=prefill.get("address", ""))
        n1, n2, n3 = st.columns(3)
        with n1:
            new_ward = st.text_input("Phường/xã")
        with n2:
            new_district = st.text_input("Quận/huyện")
        with n3:
            new_city = st.text_input("TP/Tỉnh", value="TP. HCM")
        st.markdown(f"**{t('consent.pdpl_title')}**")
        st.caption(t("consent.pdpl_body"))
        consent_ok = st.checkbox(t("consent.checkbox"), key="pdpl_consent")
        if st.button("Lưu khách hàng mới", type="secondary"):
            if not consent_ok:
                st.error(t("consent.required"))
            elif not new_name:
                st.error("Cần nhập tên khách.")
            else:
                try:
                    new_cust = cust_mod.create(
                        phone=phone_input,
                        name=new_name,
                        address=new_addr,
                        ward=new_ward,
                        district=new_district,
                        city=new_city,
                        consent_pdpl=True,
                        actor_role=current_role() or "staff",
                    )
                    st.success(f"Đã tạo khách #{new_cust.id}.")
                    st.rerun()
                except Exception as e:  # noqa: BLE001
                    st.error(f"Lỗi: {e}")

# ---------- Items block ----------
st.subheader("2. Món")
dishes_df = menu_mod.list_dishes(active_only=True)
if dishes_df.empty:
    st.warning(t("empty.no_dishes"))
    st.stop()

dish_lookup = {
    f"{int(r['id'])} — {r['name_vi']} ({format_vnd(r['price_vnd'])})": (
        int(r["id"]),
        r["name_vi"],
        Decimal(str(r["price_vnd"] or 0)),
    )
    for _, r in dishes_df.iterrows()
}

# Init item editor
if "order_items" not in st.session_state:
    st.session_state.order_items = []

prefill_items = prefill.get("items") or []
if prefill_items and not st.session_state.order_items:
    for pi in prefill_items:
        match = dishes_df[dishes_df["name_vi"].astype(str).str.contains(pi.get("dish_name", ""), case=False, na=False)]
        if not match.empty:
            row = match.iloc[0]
            st.session_state.order_items.append(
                {
                    "dish_id": int(row["id"]),
                    "dish_name_snapshot": row["name_vi"],
                    "quantity": int(pi.get("quantity", 1)),
                    "unit_price_vnd": float(row["price_vnd"] or 0),
                    "notes": pi.get("notes", ""),
                }
            )

with st.form("add_item_form", clear_on_submit=True):
    icol1, icol2, icol3, icol4 = st.columns([4, 1, 2, 1])
    with icol1:
        pick = st.selectbox("Món", list(dish_lookup.keys()))
    with icol2:
        qty = st.number_input("Số lượng", min_value=1, step=1, value=1)
    with icol3:
        item_notes = st.text_input("Ghi chú", placeholder="VD: ít đường")
    with icol4:
        submitted = st.form_submit_button("Thêm")
    if submitted:
        d_id, d_name, d_price = dish_lookup[pick]
        st.session_state.order_items.append(
            {
                "dish_id": d_id,
                "dish_name_snapshot": d_name,
                "quantity": int(qty),
                "unit_price_vnd": float(d_price),
                "notes": item_notes,
            }
        )

if st.session_state.order_items:
    items_df = pd.DataFrame(st.session_state.order_items)
    items_df["Thành tiền"] = items_df.apply(
        lambda r: format_vnd(r["unit_price_vnd"] * r["quantity"]), axis=1
    )
    items_view = items_df[["dish_name_snapshot", "quantity", "unit_price_vnd", "notes", "Thành tiền"]].rename(
        columns={
            "dish_name_snapshot": "Món",
            "quantity": "SL",
            "unit_price_vnd": "Đơn giá",
            "notes": "Ghi chú",
        }
    )
    items_view["Đơn giá"] = items_view["Đơn giá"].apply(format_vnd)
    st.dataframe(items_view, use_container_width=True, hide_index=True)
    if st.button("Xoá tất cả món", type="secondary"):
        st.session_state.order_items = []
        st.rerun()
else:
    st.info("Chưa có món nào trong đơn.")

# ---------- Discount block ----------
st.subheader("3. Khuyến mãi")
discount_kind = st.radio(
    "Loại giảm giá",
    ["none", "pct", "fixed", "campaign"],
    horizontal=True,
    format_func=lambda k: {
        "none": "Không giảm",
        "pct": "Giảm %",
        "fixed": "Giảm cố định (VNĐ)",
        "campaign": "Theo chương trình",
    }[k],
)
discount_value = 0.0
campaign_id = None
if discount_kind == "pct":
    discount_value = st.number_input("Phần trăm giảm", min_value=0.0, max_value=100.0, value=10.0)
elif discount_kind == "fixed":
    discount_value = st.number_input("Số tiền giảm (VNĐ)", min_value=0, value=10000, step=1000)
elif discount_kind == "campaign":
    active_camps = menu_mod.active_campaigns()
    if not active_camps:
        st.info(t("empty.no_campaigns"))
        discount_kind = "none"
    else:
        camp_options = {f"{c.name_vi} ({c.discount_kind} {c.discount_value})": c for c in active_camps}
        choice = st.selectbox("Chọn chương trình", list(camp_options.keys()))
        c = camp_options[choice]
        campaign_id = c.id
        discount_kind = c.discount_kind
        discount_value = float(c.discount_value)

# ---------- Delivery block ----------
st.subheader("4. Giao hàng")
dcol1, dcol2 = st.columns(2)
with dcol1:
    delivery_date = st.date_input("Ngày giao", value=datetime.now().date() + timedelta(days=1))
with dcol2:
    delivery_address = st.text_input(
        "Địa chỉ giao (mặc định = địa chỉ khách)",
        value=(found_customer.default_address if found_customer else ""),
    )
order_notes = st.text_area("Ghi chú đơn", placeholder="VD: gói quà sinh nhật, ghi tên 'Mai 25'...")

# ---------- Total preview ----------
st.subheader("5. Tổng kết")
subtotal = sum(it["unit_price_vnd"] * it["quantity"] for it in st.session_state.order_items)
if discount_kind == "pct" and discount_value:
    total = subtotal * (1 - discount_value / 100)
elif discount_kind == "fixed" and discount_value:
    total = max(0, subtotal - discount_value)
else:
    total = subtotal
total_rounded = round_vnd(total)

mc1, mc2, mc3 = st.columns(3)
mc1.metric("Tạm tính", format_vnd(subtotal))
mc2.metric("Giảm", format_vnd(subtotal - total_rounded) if subtotal > total_rounded else "0 ₫")
mc3.metric("Tổng cộng", format_vnd(total_rounded))

# ---------- Save buttons ----------
sc1, sc2, sc3 = st.columns(3)
with sc1:
    if st.button("💾 " + t("cta.save_draft"), type="secondary", use_container_width=True):
        if not customer_id:
            st.error("Cần chọn khách hàng.")
        elif not st.session_state.order_items:
            st.error("Cần thêm ít nhất 1 món.")
        else:
            order = ord_mod.create_order(
                customer_id=customer_id,
                items=st.session_state.order_items,
                delivery_date=datetime.combine(delivery_date, datetime.min.time()),
                delivery_address=delivery_address,
                discount_kind=discount_kind,
                discount_value=discount_value,
                campaign_id=campaign_id,
                notes=order_notes,
                actor_role=current_role() or "staff",
                status="draft",
            )
            st.session_state.order_items = []
            st.session_state.prefill_order = None
            st.success(t("success.order_created", id=order.id))
            st.session_state.selected_order_id = order.id
            st.switch_page("pages/03_🧾_Order_Detail.py")

with sc2:
    if st.button("✅ " + t("cta.confirm"), type="primary", use_container_width=True):
        if not customer_id:
            st.error("Cần chọn khách hàng.")
        elif not st.session_state.order_items:
            st.error("Cần thêm ít nhất 1 món.")
        else:
            order = ord_mod.create_order(
                customer_id=customer_id,
                items=st.session_state.order_items,
                delivery_date=datetime.combine(delivery_date, datetime.min.time()),
                delivery_address=delivery_address,
                discount_kind=discount_kind,
                discount_value=discount_value,
                campaign_id=campaign_id,
                notes=order_notes,
                actor_role=current_role() or "staff",
                status="confirmed",
            )
            st.session_state.order_items = []
            st.session_state.prefill_order = None
            st.success(t("success.order_confirmed", id=order.id))
            st.session_state.selected_order_id = order.id
            st.switch_page("pages/03_🧾_Order_Detail.py")

with sc3:
    if st.button(t("cta.cancel"), use_container_width=True):
        st.session_state.order_items = []
        st.session_state.prefill_order = None
        st.rerun()
