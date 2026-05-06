"""Ngọt — Pastry & Cake Studio. Dashboard (entrypoint).

Streamlit Cloud convention: this file is the home page; pages/ auto-routes the rest.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import streamlit as st

from lib import sheets_client
from lib.auth import current_role, require_auth, signout
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_date_vi, format_vnd
from lib.i18n import t
from lib.images import topical_image_url
from lib.modules import financials as fin_mod
from lib.modules import inventory as inv_mod

st.set_page_config(
    page_title="Ngọt — Pastry & Cake Studio",
    page_icon="🍰",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Sidebar branding
with st.sidebar:
    render_brand_logo("both", size_px=44)
    st.markdown("---")
    if current_role():
        st.caption(t("auth.signed_in_as", role=current_role()))
        if st.button(t("auth.signout"), key="signout_btn", use_container_width=True):
            signout()
            st.rerun()


def _hero_image() -> str:
    return topical_image_url("ngot-bakery-hero", 1400, 360, entity_name="Dish")


def _show_dashboard() -> None:
    st.markdown(
        f"<img src='{_hero_image()}' style='width:100%;border-radius:12px;height:200px;object-fit:cover;margin-bottom:1rem;' />",
        unsafe_allow_html=True,
    )
    st.title(t("nav.dashboard"))
    st.caption(f"Hôm nay: {format_date_vi(datetime.now())}")

    # Try to load data; show graceful empty state if not configured
    try:
        orders = sheets_client.read_tab("Orders")
        ingredients = sheets_client.read_tab("Ingredients")
    except Exception as e:  # noqa: BLE001
        st.warning(t("error.sheets_not_set"))
        st.caption(f"({e})")
        st.info("Vào /Sheets_Setup để khởi tạo, rồi vào /Settings để cấu hình kết nối.")
        return

    today = datetime.now().date()
    cutoff_today = pd.Timestamp(today)
    cutoff_tomorrow = pd.Timestamp(today + timedelta(days=1))

    # KPIs
    today_orders_count = 0
    today_revenue = 0
    if not orders.empty:
        orders = orders.copy()
        orders["delivery_date_dt"] = pd.to_datetime(orders["delivery_date"], errors="coerce")
        orders["order_date_dt"] = pd.to_datetime(orders["order_date"], errors="coerce")
        today_orders = orders[
            (orders["delivery_date_dt"] >= cutoff_today)
            & (orders["delivery_date_dt"] < cutoff_tomorrow)
            & (orders["status"].astype(str).isin(["confirmed", "in_progress", "ready"]))
        ]
        today_orders_count = int(len(today_orders))
        # revenue this month
        valid = orders[
            orders["status"].astype(str).isin(["confirmed", "in_progress", "ready", "delivered"])
        ]
        today_revenue = int(
            pd.to_numeric(
                valid[valid["order_date_dt"].dt.date == today]["total_vnd"], errors="coerce"
            )
            .fillna(0)
            .sum()
        )

    low_stock_count = 0
    if not ingredients.empty:
        ingredients = ingredients.copy()
        ingredients["cs"] = pd.to_numeric(ingredients["current_stock"], errors="coerce").fillna(0)
        ingredients["rt"] = pd.to_numeric(ingredients["reorder_threshold"], errors="coerce").fillna(0)
        low_stock_count = int(len(ingredients[ingredients["cs"] < ingredients["rt"]]))

    pnl_now = fin_mod.pnl_summary(datetime.now().year, datetime.now().month)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Đơn giao hôm nay", f"{today_orders_count}")
    c2.metric("Doanh thu hôm nay", format_vnd(today_revenue))
    c3.metric("Doanh thu tháng", format_vnd(pnl_now.get("revenue_vnd", 0)))
    c4.metric("Nguyên liệu sắp hết", f"{low_stock_count}", delta_color="inverse")

    st.markdown("---")

    col_a, col_b = st.columns([2, 1])
    with col_a:
        st.subheader("Doanh thu 7 ngày qua")
        rev = fin_mod.revenue_by_day(days=7)
        if rev.empty:
            st.info("Chưa có dữ liệu doanh thu.")
        else:
            rev = rev.set_index("day")
            st.line_chart(rev["revenue_vnd"], height=220)

        st.subheader("Đơn hàng gần đây")
        if orders.empty:
            st.info(t("empty.no_orders"))
        else:
            recent = orders.sort_values("order_date_dt", ascending=False).head(8)
            cols = ["id", "customer_id", "status", "delivery_date", "total_vnd"]
            recent_view = recent[[c for c in cols if c in recent.columns]].copy()
            if "total_vnd" in recent_view.columns:
                recent_view["total_vnd"] = recent_view["total_vnd"].apply(
                    lambda v: format_vnd(v)
                )
            recent_view.columns = ["#", "Khách (id)", "Trạng thái", "Giao", "Tổng"][:len(recent_view.columns)]
            st.dataframe(recent_view, use_container_width=True, hide_index=True)

    with col_b:
        st.subheader("Cảnh báo tồn kho")
        low = inv_mod.low_stock_ingredients()
        if low.empty:
            st.success(t("empty.no_low_stock"))
        else:
            for _, row in low.head(8).iterrows():
                st.warning(
                    f"⚠️ **{row.get('name_vi', '?')}** — còn {row.get('current_stock', 0)} {row.get('unit', '')} "
                    f"(ngưỡng {row.get('reorder_threshold', 0)})"
                )
        st.markdown("---")
        st.subheader("Lối tắt")
        st.page_link("pages/02_➕_New_Order.py", label="➕ Tạo đơn mới", use_container_width=True)
        st.page_link("pages/05_🛒_Inventory_Purchase.py", label="🛒 Nhập kho", use_container_width=True)
        st.page_link("pages/15_🤖_Assistant.py", label="🤖 Trợ lý Ngọt", use_container_width=True)


# ---------- Main ----------
require_auth()
_show_dashboard()

st.markdown("---")
st.caption(
    "Ngọt v0.1 — Streamlit + Google Sheets + Gemini. Made with ♥ for Vietnamese bakeries."
)
