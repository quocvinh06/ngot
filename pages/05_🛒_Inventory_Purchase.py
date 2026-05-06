"""Inventory Purchase — record purchase movements (multi-row)."""
from __future__ import annotations

import streamlit as st

from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd
from lib.i18n import t
from lib.modules import inventory as inv_mod

st.set_page_config(page_title="Nhập kho — Ngọt", page_icon="🛒", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()
st.title(t("nav.inventory_purchase"))
st.caption("Ghi nhận một hoặc nhiều nguyên liệu vừa mua. Tồn kho và giá vốn TB sẽ tự cập nhật.")

ings = inv_mod.list_ingredients()
if ings.empty:
    st.warning(t("empty.no_ingredients"))
    st.stop()

ing_lookup = {f"#{int(r['id'])} — {r['name_vi']} ({r['unit']})": (int(r["id"]), r["name_vi"], r["unit"]) for _, r in ings.iterrows()}

with st.form("purchase_form", clear_on_submit=True):
    pcol1, pcol2, pcol3, pcol4 = st.columns([3, 1, 2, 3])
    with pcol1:
        choice = st.selectbox("Nguyên liệu", list(ing_lookup.keys()))
    with pcol2:
        qty = st.number_input("Số lượng", min_value=0.01, step=0.5, value=1.0)
    with pcol3:
        unit_price = st.number_input("Đơn giá (VNĐ)", min_value=0, step=1000, value=10000)
    with pcol4:
        notes = st.text_input("Ghi chú", placeholder="VD: Sỉ Metro 06/05")
    submitted = st.form_submit_button("➕ Ghi nhận", type="primary")
    if submitted:
        ing_id, ing_name, _ = ing_lookup[choice]
        try:
            mid = inv_mod.record_purchase(
                ingredient_id=ing_id,
                quantity=float(qty),
                unit_price_vnd=float(unit_price),
                notes=notes,
                actor_role=current_role() or "staff",
            )
            st.success(f"Đã nhập kho **{qty} × {ing_name}** (movement #{mid}, tổng {format_vnd(qty * unit_price)}).")
        except Exception as e:  # noqa: BLE001
            st.error(f"Lỗi: {e}")

st.markdown("---")
st.subheader("Giao dịch nhập kho gần đây")
mv = inv_mod.list_movements()
if mv.empty:
    st.info("Chưa có giao dịch nào.")
else:
    purchases = mv[mv["kind"].astype(str) == "purchase"].head(20)
    if purchases.empty:
        st.info("Chưa có giao dịch nhập.")
    else:
        # join ingredient name
        merged = purchases.merge(
            ings[["id", "name_vi", "unit"]],
            left_on="ingredient_id",
            right_on="id",
            how="left",
            suffixes=("", "_ing"),
        )
        view = merged[["occurred_at", "name_vi", "quantity", "unit", "unit_price_vnd", "total_vnd", "notes"]].rename(
            columns={
                "occurred_at": "Thời gian",
                "name_vi": "Nguyên liệu",
                "quantity": "SL",
                "unit": "ĐVT",
                "unit_price_vnd": "Đơn giá",
                "total_vnd": "Tổng",
                "notes": "Ghi chú",
            }
        )
        view["Đơn giá"] = view["Đơn giá"].apply(format_vnd)
        view["Tổng"] = view["Tổng"].apply(format_vnd)
        st.dataframe(view, use_container_width=True, hide_index=True)
