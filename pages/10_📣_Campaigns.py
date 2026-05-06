"""Campaigns — list + create/edit."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import streamlit as st

from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_date_vi
from lib.i18n import t
from lib.models import Campaign
from lib.modules import menu as menu_mod

st.set_page_config(page_title="Khuyến mãi — Ngọt", page_icon="📣", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()
st.title(t("nav.campaigns"))

camps = menu_mod.list_campaigns()
if not camps.empty:
    st.subheader("Hiện có")
    rows = []
    for _, c in camps.iterrows():
        rows.append(
            {
                "#": c.get("id"),
                "Tên": c.get("name_vi"),
                "Loại": c.get("discount_kind"),
                "Giảm": c.get("discount_value"),
                "Áp dụng": c.get("applies_to"),
                "Bắt đầu": format_date_vi(c.get("starts_at")),
                "Kết thúc": format_date_vi(c.get("ends_at")),
                "Đang chạy": c.get("is_active"),
            }
        )
    st.dataframe(rows, use_container_width=True, hide_index=True)
else:
    st.info(t("empty.no_campaigns"))

st.markdown("---")
st.subheader("Tạo chương trình mới")
with st.form("new_campaign"):
    name = st.text_input("Tên chương trình")
    kcol1, kcol2 = st.columns(2)
    with kcol1:
        kind = st.selectbox("Loại giảm", ["pct", "fixed"], format_func=lambda k: "Phần trăm" if k == "pct" else "Cố định")
    with kcol2:
        value = st.number_input(
            "Giá trị giảm",
            min_value=0.0,
            value=10.0 if kind == "pct" else 10000.0,
        )
    applies = st.selectbox(
        "Áp dụng cho",
        ["all", "category", "dish"],
        format_func=lambda x: {"all": "Tất cả", "category": "Theo danh mục", "dish": "Theo món"}[x],
    )
    applies_value = ""
    if applies != "all":
        applies_value = st.text_input(
            "Giá trị áp dụng (tên danh mục hoặc dish_id)"
        )
    dcol1, dcol2 = st.columns(2)
    with dcol1:
        starts = st.date_input("Bắt đầu", value=datetime.now().date())
    with dcol2:
        ends = st.date_input("Kết thúc", value=(datetime.now() + timedelta(days=14)).date())
    active = st.toggle("Kích hoạt ngay", value=True)
    if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
        if not name:
            st.error("Cần đặt tên cho chương trình.")
        else:
            c = Campaign(
                name_vi=name,
                discount_kind=kind,
                discount_value=Decimal(str(value)),
                applies_to=applies,
                applies_to_value=applies_value or None,
                starts_at=datetime.combine(starts, datetime.min.time()),
                ends_at=datetime.combine(ends, datetime.min.time()),
                is_active=active,
                stack_with_others=False,
            )
            cid = menu_mod.upsert_campaign(c, current_role() or "staff")
            st.success(f"Đã tạo chương trình #{cid}.")
            st.rerun()
