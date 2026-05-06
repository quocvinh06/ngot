"""Ingredient detail — movement chart, edit metadata."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd
from lib.i18n import t
from lib.images import ingredient_image_url
from lib.models import Ingredient
from lib.modules import inventory as inv_mod

st.set_page_config(page_title="Nguyên liệu — Ngọt", page_icon="🥖", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()

ing_id = st.session_state.get("selected_ingredient_id")
if ing_id is None:
    qp = st.query_params.get("id")
    if qp:
        try:
            ing_id = int(qp)
        except (ValueError, TypeError):
            ing_id = None
if ing_id is None:
    inp = st.number_input("Nhập # nguyên liệu", min_value=1, step=1)
    if st.button("Mở"):
        st.session_state.selected_ingredient_id = int(inp)
        st.rerun()
    st.stop()

ing = inv_mod.get_ingredient(int(ing_id))
if ing is None:
    st.error("Không tìm thấy nguyên liệu.")
    st.stop()

st.title(f"🥖 {ing.name_vi}")
hcol1, hcol2 = st.columns([1, 2])
with hcol1:
    st.image(ingredient_image_url(ing.name_vi), use_container_width=True)
with hcol2:
    st.metric("Tồn hiện tại", f"{ing.current_stock} {ing.unit}")
    st.metric("Giá vốn TB", format_vnd(ing.weighted_avg_cost_vnd or 0))
    st.caption(f"Ngưỡng cảnh báo: {ing.reorder_threshold or 0} {ing.unit}")
    st.caption(f"NCC: {ing.supplier_name or '_(chưa khai báo)_'} · {ing.supplier_phone or ''}")

st.markdown("---")
st.subheader("Lịch sử biến động")
mv = inv_mod.list_movements(ingredient_id=int(ing_id))
if mv.empty:
    st.info("Chưa có biến động nào.")
else:
    mv = mv.copy()
    mv["dt"] = pd.to_datetime(mv["occurred_at"], errors="coerce")
    mv["qty_signed"] = mv.apply(
        lambda r: float(r["quantity"]) if r["kind"] in ("purchase", "adjustment") else -float(r["quantity"]),
        axis=1,
    )
    mv = mv.sort_values("dt")
    mv["running_stock"] = mv["qty_signed"].cumsum()
    chart = mv.set_index("dt")[["running_stock"]].rename(columns={"running_stock": ing.unit})
    st.line_chart(chart, height=240)

    view = mv[["occurred_at", "kind", "quantity", "unit_price_vnd", "total_vnd", "related_order_id", "notes"]].rename(
        columns={
            "occurred_at": "Thời gian",
            "kind": "Loại",
            "quantity": "SL",
            "unit_price_vnd": "Đơn giá",
            "total_vnd": "Tổng",
            "related_order_id": "Đơn liên quan",
            "notes": "Ghi chú",
        }
    )
    view["Đơn giá"] = view["Đơn giá"].apply(lambda v: format_vnd(v) if v else "")
    view["Tổng"] = view["Tổng"].apply(lambda v: format_vnd(v) if v else "")
    st.dataframe(view.tail(50), use_container_width=True, hide_index=True)

st.markdown("---")
st.subheader("Sửa thông tin")
with st.form("edit_ing_form"):
    new_name = st.text_input("Tên", value=ing.name_vi)
    new_unit = st.text_input("ĐVT", value=ing.unit)
    new_thresh = st.number_input(
        "Ngưỡng cảnh báo", value=float(ing.reorder_threshold or 0), step=1.0
    )
    new_supplier = st.text_input("Nhà cung cấp", value=ing.supplier_name or "")
    new_supplier_phone = st.text_input("SĐT NCC", value=ing.supplier_phone or "")
    new_notes = st.text_area("Ghi chú", value=ing.notes or "")
    if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
        upd = Ingredient(
            id=ing.id,
            name_vi=new_name,
            unit=new_unit,
            current_stock=ing.current_stock,
            reorder_threshold=new_thresh,
            last_purchase_price_vnd=ing.last_purchase_price_vnd,
            weighted_avg_cost_vnd=ing.weighted_avg_cost_vnd,
            supplier_name=new_supplier,
            supplier_phone=new_supplier_phone,
            notes=new_notes,
        )
        inv_mod.upsert_ingredient(upd, current_role() or "staff")
        st.success("Đã lưu.")
        st.rerun()
