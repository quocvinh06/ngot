"""Menu — dish list with active/retired tabs."""
from __future__ import annotations

import streamlit as st

from lib.auth import require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_vnd
from lib.i18n import t
from lib.images import dish_image_url
from lib.modules import menu as menu_mod

st.set_page_config(page_title="Thực đơn — Ngọt", page_icon="🍰", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()
st.title(t("nav.menu"))

dishes = menu_mod.list_dishes()
if dishes.empty:
    st.info(t("empty.no_dishes"))
    st.page_link("pages/08_✏️_Menu_Edit.py", label="➕ " + t("cta.add_dish"))
    st.stop()

tab1, tab2 = st.tabs(["Đang bán", "Đã ngưng"])

active = dishes[dishes["is_active"].astype(str).str.upper().isin(["TRUE", "1", "YES"])]
retired = dishes[~dishes["is_active"].astype(str).str.upper().isin(["TRUE", "1", "YES"])]


def _render_grid(df):
    if df.empty:
        st.info("Không có món nào.")
        return
    cols = st.columns(3)
    for idx, (_, row) in enumerate(df.iterrows()):
        with cols[idx % 3]:
            img_url = row.get("image_url") or dish_image_url(row["name_vi"])
            st.image(img_url, use_container_width=True)
            st.markdown(f"**#{int(row['id'])} — {row['name_vi']}**")
            st.caption(f"{row.get('category', 'other')} · {row.get('size', '')}")
            st.markdown(f"### {format_vnd(row['price_vnd'])}")
            if row.get("description_vi"):
                st.caption(str(row["description_vi"])[:80])
            ec1, ec2 = st.columns(2)
            with ec1:
                if st.button("✏️ Sửa", key=f"edit_{row['id']}"):
                    st.session_state.editing_dish_id = int(row["id"])
                    st.switch_page("pages/08_✏️_Menu_Edit.py")
            with ec2:
                pass


with tab1:
    cf = st.text_input("Lọc theo danh mục", placeholder="cake, pastry, …")
    cur = active
    if cf:
        cur = cur[cur["category"].astype(str).str.contains(cf, case=False, na=False)]
    _render_grid(cur)

with tab2:
    _render_grid(retired)

st.markdown("---")
st.page_link("pages/08_✏️_Menu_Edit.py", label="➕ " + t("cta.add_dish"))
