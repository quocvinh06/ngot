"""Customer detail — profile, orders, edit."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from lib import sheets_client
from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_date_vi, format_vnd
from lib.i18n import t
from lib.modules import customers as cust_mod

st.set_page_config(page_title="Khách — Ngọt", page_icon="📇", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()

cid = st.session_state.get("selected_customer_id")
if cid is None:
    qp = st.query_params.get("id")
    if qp:
        try:
            cid = int(qp)
        except (ValueError, TypeError):
            cid = None
if cid is None:
    inp = st.number_input("Nhập # khách", min_value=1, step=1)
    if st.button("Mở"):
        st.session_state.selected_customer_id = int(inp)
        st.rerun()
    st.stop()

c = cust_mod.get(int(cid))
if c is None:
    st.error("Không tìm thấy khách.")
    st.stop()

st.title(f"📇 {c.name}")
ltv = cust_mod.aggregate_ltv(c.id)
mc1, mc2, mc3 = st.columns(3)
mc1.metric("Số đơn", ltv["orders_count"])
mc2.metric("Đã chi", format_vnd(ltv["total_spend_vnd"]))
mc3.metric("Đơn gần nhất", format_date_vi(ltv["last_order_date"]))

st.markdown("---")
st.subheader("Thông tin")
st.markdown(
    f"""
- **SĐT**: `{c.phone}`
- **Địa chỉ mặc định**: {c.default_address or '_(không có)_'}
- **Phường/xã**: {c.ward or '—'} · **Quận/huyện**: {c.district or '—'} · **TP**: {c.city or '—'}
- **PDPL consent**: {'✓' if c.consent_pdpl else '✗'} (lúc {format_date_vi(c.consent_at) if c.consent_at else '—'})
- **Tạo bởi**: {c.created_by} ({format_date_vi(c.created_at)})
- **Ghi chú**: {c.notes or '—'}
"""
)

st.markdown("---")
st.subheader("Lịch sử đơn")
orders = sheets_client.read_tab("Orders")
if orders.empty:
    st.info("Chưa có đơn nào.")
else:
    cust_orders = orders[pd.to_numeric(orders["customer_id"], errors="coerce") == c.id].copy()
    if cust_orders.empty:
        st.info("Khách này chưa có đơn nào.")
    else:
        cust_orders = cust_orders.sort_values("order_date", ascending=False)
        view = cust_orders[["id", "status", "delivery_date", "total_vnd"]].rename(
            columns={
                "id": "#",
                "status": "Trạng thái",
                "delivery_date": "Giao",
                "total_vnd": "Tổng",
            }
        )
        view["Giao"] = view["Giao"].apply(format_date_vi)
        view["Tổng"] = view["Tổng"].apply(format_vnd)
        st.dataframe(view, use_container_width=True, hide_index=True)

st.markdown("---")
st.subheader("Sửa thông tin")
with st.form("edit_cust"):
    nm = st.text_input("Tên", value=c.name)
    addr = st.text_area("Địa chỉ", value=c.default_address or "")
    cl1, cl2, cl3 = st.columns(3)
    with cl1:
        ward = st.text_input("Phường/xã", value=c.ward or "")
    with cl2:
        district = st.text_input("Quận/huyện", value=c.district or "")
    with cl3:
        city = st.text_input("TP/Tỉnh", value=c.city or "")
    notes = st.text_area("Ghi chú", value=c.notes or "")
    if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
        cust_mod.update(
            c.id,
            {
                "name": nm,
                "default_address": addr,
                "ward": ward,
                "district": district,
                "city": city,
                "notes": notes,
            },
            current_role() or "staff",
        )
        st.success("Đã lưu.")
        st.rerun()
