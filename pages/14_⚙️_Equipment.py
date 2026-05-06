"""Equipment — admin-only list + add."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import streamlit as st

from lib.auth import current_role, require_admin
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_date_vi, format_vnd
from lib.i18n import t
from lib.models import Equipment
from lib.modules import financials as fin_mod

st.set_page_config(page_title="Thiết bị — Ngọt", page_icon="⚙️", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.equipment"))

df = fin_mod.list_equipment()
if df.empty:
    st.info(t("empty.no_equipment"))
else:
    view = df[
        [
            "id",
            "name_vi",
            "purchased_at",
            "purchase_price_vnd",
            "useful_life_months",
            "monthly_depreciation_vnd",
            "is_active",
        ]
    ].rename(
        columns={
            "id": "#",
            "name_vi": "Thiết bị",
            "purchased_at": "Ngày mua",
            "purchase_price_vnd": "Giá mua",
            "useful_life_months": "Tuổi thọ (tháng)",
            "monthly_depreciation_vnd": "Khấu hao tháng",
            "is_active": "Hoạt động",
        }
    )
    view["Ngày mua"] = view["Ngày mua"].apply(format_date_vi)
    view["Giá mua"] = view["Giá mua"].apply(format_vnd)
    view["Khấu hao tháng"] = view["Khấu hao tháng"].apply(format_vnd)
    st.dataframe(view, use_container_width=True, hide_index=True)
    st.metric("Tổng khấu hao tháng", format_vnd(fin_mod.monthly_depreciation_total()))

st.markdown("---")
st.subheader("Thêm thiết bị")
with st.form("eq_form"):
    name = st.text_input("Tên thiết bị")
    cc1, cc2, cc3 = st.columns(3)
    with cc1:
        purchased = st.date_input("Ngày mua", value=datetime.now().date())
    with cc2:
        price = st.number_input("Giá mua (VNĐ)", min_value=0, step=10000)
    with cc3:
        life = st.number_input("Tuổi thọ (tháng)", min_value=1, value=60, step=1)
    salvage = st.number_input("Giá trị thanh lý (VNĐ)", min_value=0, value=0, step=1000)
    notes = st.text_area("Ghi chú")
    if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
        if not name or price <= 0:
            st.error("Tên và giá là bắt buộc.")
        else:
            eq = Equipment(
                name_vi=name,
                purchased_at=datetime.combine(purchased, datetime.min.time()),
                purchase_price_vnd=Decimal(price),
                useful_life_months=int(life),
                salvage_value_vnd=Decimal(salvage),
                monthly_depreciation_vnd=Decimal(0),
                is_active=True,
                notes=notes,
            )
            new_id = fin_mod.upsert_equipment(eq, current_role() or "admin")
            st.success(f"Đã thêm thiết bị #{new_id}.")
            st.rerun()
