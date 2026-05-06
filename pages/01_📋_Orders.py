"""Orders list — search/filter/sort."""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import streamlit as st

from lib import sheets_client
from lib.auth import require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_date_vi, format_vnd, normalize_vn_phone
from lib.i18n import t

st.set_page_config(page_title="Đơn hàng — Ngọt", page_icon="📋", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()

st.title(t("nav.orders"))

orders = sheets_client.read_tab("Orders")
customers = sheets_client.read_tab("Customers")

if orders.empty:
    st.info(t("empty.no_orders"))
    st.page_link("pages/02_➕_New_Order.py", label="➕ " + t("nav.new_order"))
    st.stop()

# Join with customer info
orders = orders.copy()
orders["delivery_date_dt"] = pd.to_datetime(orders["delivery_date"], errors="coerce")
orders["order_date_dt"] = pd.to_datetime(orders["order_date"], errors="coerce")
if not customers.empty:
    customers["id_int"] = pd.to_numeric(customers["id"], errors="coerce")
    orders["customer_id_int"] = pd.to_numeric(orders["customer_id"], errors="coerce")
    orders = orders.merge(
        customers[["id_int", "name", "phone"]],
        left_on="customer_id_int",
        right_on="id_int",
        how="left",
        suffixes=("", "_cust"),
    )

# Filters
fcol1, fcol2, fcol3, fcol4 = st.columns(4)
with fcol1:
    status_filter = st.selectbox(
        "Trạng thái",
        ["(tất cả)", "draft", "confirmed", "in_progress", "ready", "delivered", "cancelled"],
        index=0,
    )
with fcol2:
    phone_q = st.text_input("Tìm theo SĐT", placeholder="09xxx hoặc tên")
with fcol3:
    today = datetime.now().date()
    date_from = st.date_input("Từ ngày", value=today - timedelta(days=30))
with fcol4:
    date_to = st.date_input("Đến ngày", value=today + timedelta(days=14))

filtered = orders.copy()
if status_filter != "(tất cả)":
    filtered = filtered[filtered["status"].astype(str) == status_filter]
if phone_q:
    norm = normalize_vn_phone(phone_q) if any(ch.isdigit() for ch in phone_q) else ""
    if norm:
        filtered = filtered[
            filtered["phone"].astype(str).map(normalize_vn_phone) == norm
        ]
    else:
        filtered = filtered[filtered["name"].astype(str).str.contains(phone_q, case=False, na=False)]
filtered = filtered[
    (filtered["delivery_date_dt"].dt.date >= date_from)
    & (filtered["delivery_date_dt"].dt.date <= date_to)
]

st.caption(f"Tìm thấy **{len(filtered)}** đơn.")

# Render
view_cols = ["id", "name", "phone", "status", "delivery_date", "total_vnd"]
filtered = filtered.sort_values("delivery_date_dt", ascending=True)
view = filtered[[c for c in view_cols if c in filtered.columns]].copy()
view = view.rename(
    columns={
        "id": "#",
        "name": "Khách",
        "phone": "SĐT",
        "status": "Trạng thái",
        "delivery_date": "Giao",
        "total_vnd": "Tổng",
    }
)
if "Tổng" in view.columns:
    view["Tổng"] = view["Tổng"].apply(format_vnd)
if "Giao" in view.columns:
    view["Giao"] = view["Giao"].apply(format_date_vi)

st.dataframe(view, use_container_width=True, hide_index=True)

st.markdown("---")
ccol1, ccol2 = st.columns([1, 5])
with ccol1:
    st.page_link("pages/02_➕_New_Order.py", label="➕ " + t("nav.new_order"))
with ccol2:
    selected = st.number_input("Mở chi tiết đơn (id)", min_value=1, step=1)
    if st.button("Mở", key="open_detail"):
        st.session_state.selected_order_id = int(selected)
        st.switch_page("pages/03_🧾_Order_Detail.py")
