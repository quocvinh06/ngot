"""Customers list — phone search + LTV ranking."""
from __future__ import annotations

import streamlit as st

from lib.auth import require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd, normalize_vn_phone
from lib.i18n import t
from lib.modules import customers as cust_mod

st.set_page_config(page_title="Khách hàng — Ngọt", page_icon="👥", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()
st.title(t("nav.customers"))

df = cust_mod.list_with_ltv()
if df.empty:
    st.info(t("empty.no_customers"))
    st.stop()

q = st.text_input("Tìm theo SĐT hoặc tên")
if q:
    norm = normalize_vn_phone(q) if any(ch.isdigit() for ch in q) else ""
    if norm:
        df = df[df["phone"].astype(str).map(normalize_vn_phone) == norm]
    else:
        df = df[df["name"].astype(str).str.contains(q, case=False, na=False)]

df = df.sort_values("total_spend_vnd", ascending=False)

view_cols = ["id", "name", "phone", "city", "orders_count", "total_spend_vnd"]
view = df[[c for c in view_cols if c in df.columns]].copy()
view = view.rename(
    columns={
        "id": "#",
        "name": "Tên",
        "phone": "SĐT",
        "city": "Thành phố",
        "orders_count": "Số đơn",
        "total_spend_vnd": "Đã chi",
    }
)
if "Đã chi" in view.columns:
    view["Đã chi"] = view["Đã chi"].apply(format_vnd)
st.dataframe(view, use_container_width=True, hide_index=True)

st.markdown("---")
sel = st.number_input("Mở chi tiết khách (id)", min_value=1, step=1)
if st.button("Mở", key="open_cust_detail"):
    st.session_state.selected_customer_id = int(sel)
    st.switch_page("pages/12_📇_Customer_Detail.py")
