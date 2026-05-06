"""Inventory — ingredients list with stock + low-stock filter."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from lib.auth import require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd
from lib.i18n import t
from lib.modules import inventory as inv_mod

st.set_page_config(page_title="Tồn kho — Ngọt", page_icon="📦", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()

st.title(t("nav.inventory"))

ings = inv_mod.list_ingredients()
if ings.empty:
    st.info(t("empty.no_ingredients"))
    st.page_link("pages/05_🛒_Inventory_Purchase.py", label="🛒 " + t("cta.record_purchase"))
    st.stop()

# Filters
fcol1, fcol2 = st.columns([2, 1])
with fcol1:
    q = st.text_input("Tìm theo tên nguyên liệu")
with fcol2:
    only_low = st.toggle("Chỉ hiển thị sắp hết", value=False)

df = ings.copy()
df["current_stock_num"] = pd.to_numeric(df["current_stock"], errors="coerce").fillna(0)
df["reorder_threshold_num"] = pd.to_numeric(df["reorder_threshold"], errors="coerce").fillna(0)
df["price_fmt"] = df["weighted_avg_cost_vnd"].apply(format_vnd)
df["status_label"] = df.apply(
    lambda r: "🔴 SẮP HẾT" if r["current_stock_num"] < r["reorder_threshold_num"] else "🟢 ĐỦ",
    axis=1,
)
if q:
    df = df[df["name_vi"].astype(str).str.contains(q, case=False, na=False)]
if only_low:
    df = df[df["current_stock_num"] < df["reorder_threshold_num"]]

view = df[["id", "name_vi", "unit", "current_stock", "reorder_threshold", "price_fmt", "supplier_name", "status_label"]].rename(
    columns={
        "id": "#",
        "name_vi": "Nguyên liệu",
        "unit": "ĐVT",
        "current_stock": "Tồn",
        "reorder_threshold": "Ngưỡng",
        "price_fmt": "Giá TB",
        "supplier_name": "NCC",
        "status_label": "Trạng thái",
    }
)
st.dataframe(view, use_container_width=True, hide_index=True)

st.markdown("---")
ccol1, ccol2 = st.columns(2)
with ccol1:
    st.page_link("pages/05_🛒_Inventory_Purchase.py", label="🛒 " + t("cta.record_purchase"))
with ccol2:
    sel = st.number_input("Mở chi tiết nguyên liệu (id)", min_value=1, step=1)
    if st.button("Mở", key="open_ing_detail"):
        st.session_state.selected_ingredient_id = int(sel)
        st.switch_page("pages/06_🥖_Inventory_Detail.py")
