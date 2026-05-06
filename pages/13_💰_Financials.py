"""Financials — admin-only P&L dashboard."""
from __future__ import annotations

from datetime import datetime

import streamlit as st

from lib.auth import current_role, require_admin
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd
from lib.i18n import t
from lib.modules import assistant as assistant_mod
from lib.modules import financials as fin_mod

st.set_page_config(page_title="Tài chính — Ngọt", page_icon="💰", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.financials"))
st.caption("⚠️ Khu vực bảo mật — chỉ quản trị viên xem được.")

now = datetime.now()
mc1, mc2 = st.columns([1, 1])
with mc1:
    year = st.number_input("Năm", min_value=2024, max_value=now.year + 1, value=now.year, step=1)
with mc2:
    month = st.number_input("Tháng", min_value=1, max_value=12, value=now.month, step=1)

summary = fin_mod.pnl_summary(int(year), int(month))

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Doanh thu", format_vnd(summary["revenue_vnd"]))
c2.metric("COGS (giá vốn)", format_vnd(summary["cogs_vnd"]))
c3.metric("Lợi nhuận gộp", format_vnd(summary["gross_profit_vnd"]))
c4.metric("Khấu hao TB", format_vnd(summary["depreciation_vnd"]))
c5.metric("Lợi nhuận ròng", format_vnd(summary["net_profit_vnd"]))

st.caption(
    f"Biên lãi gộp: {summary['gross_margin_pct']}% — {t('info.depreciation_note')}"
)

st.markdown("---")
st.subheader("P&L theo từng món")
per_dish = fin_mod.pnl_per_dish(int(year), int(month))
if per_dish.empty:
    st.info("Chưa có dữ liệu cho kỳ này.")
else:
    view = per_dish.copy()
    view["revenue_vnd"] = view["revenue_vnd"].apply(format_vnd)
    view["cogs_vnd"] = view["cogs_vnd"].apply(format_vnd)
    view["gross_profit_vnd"] = view["gross_profit_vnd"].apply(format_vnd)
    view = view.rename(
        columns={
            "dish_id": "#",
            "name_vi": "Món",
            "units": "SL",
            "revenue_vnd": "Doanh thu",
            "cogs_vnd": "COGS",
            "gross_profit_vnd": "Lãi gộp",
            "margin_pct": "Biên %",
        }
    )
    st.dataframe(view, use_container_width=True, hide_index=True)
    st.download_button(
        "📥 " + t("cta.export_csv"),
        data=fin_mod.export_pnl_csv(int(year), int(month)),
        file_name=f"pnl-{year}-{int(month):02d}.csv",
        mime="text/csv",
    )

st.markdown("---")
st.subheader("🤖 Trợ lý giải thích")
if st.button("Yêu cầu trợ lý giải thích báo cáo"):
    with st.spinner("Đang gọi trợ lý..."):
        try:
            narrative = assistant_mod.explain_pnl(
                f"{int(year)}-{int(month):02d}", summary, current_role() or "admin"
            )
            if narrative:
                st.success(narrative)
            else:
                st.warning("Trợ lý không trả về kết quả (kiểm tra cấu hình Gemini API).")
        except Exception as e:  # noqa: BLE001
            st.error(f"Lỗi: {e}")
