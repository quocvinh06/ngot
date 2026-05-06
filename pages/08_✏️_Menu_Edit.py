"""Menu Edit — add or edit a dish."""
from __future__ import annotations

from decimal import Decimal

import streamlit as st

from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.i18n import t
from lib.models import Dish
from lib.modules import menu as menu_mod

st.set_page_config(page_title="Sửa món — Ngọt", page_icon="✏️", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()
st.title(t("nav.menu_edit"))

editing_id = st.session_state.get("editing_dish_id")
existing: Dish | None = None
if editing_id:
    existing = menu_mod.get_dish(int(editing_id))

with st.form("dish_form"):
    name_vi = st.text_input("Tên (tiếng Việt)", value=existing.name_vi if existing else "")
    name_en = st.text_input("Tên (tiếng Anh, tuỳ chọn)", value=existing.name_en if existing else "")
    cat_options = ["cake", "pastry", "bread", "tart", "cupcake", "cookie", "drink", "other"]
    cat = st.selectbox(
        "Danh mục",
        cat_options,
        index=cat_options.index(existing.category) if existing and existing.category in cat_options else 0,
    )
    pcol1, pcol2 = st.columns(2)
    with pcol1:
        price = st.number_input(
            "Giá (VNĐ)",
            min_value=0,
            step=1000,
            value=int(existing.price_vnd) if existing and existing.price_vnd else 0,
        )
    with pcol2:
        size = st.text_input("Kích cỡ", value=existing.size if existing else "")
    desc = st.text_area("Mô tả", value=existing.description_vi if existing else "")
    image_url = st.text_input(
        "URL ảnh (để trống = tự động)", value=existing.image_url if existing else ""
    )
    allergens = st.multiselect(
        "Dị ứng",
        ["gluten", "dairy", "egg", "nut", "soy", "sesame"],
        default=existing.allergens or [] if existing else [],
    )
    is_active = st.toggle(
        "Đang bán", value=existing.is_active if existing else True
    )
    submit = st.form_submit_button("💾 " + t("cta.save"), type="primary")
    if submit:
        if not name_vi or price <= 0:
            st.error("Tên và giá là bắt buộc.")
        else:
            d = Dish(
                id=existing.id if existing else None,
                name_vi=name_vi,
                name_en=name_en,
                category=cat,
                price_vnd=Decimal(price),
                size=size,
                description_vi=desc,
                image_url=image_url or None,
                is_active=is_active,
                allergens=allergens,
            )
            new_id = menu_mod.upsert_dish(d, current_role() or "staff")
            st.success(f"Đã lưu món #{new_id}.")
            st.session_state.editing_dish_id = None
            st.switch_page("pages/07_🍰_Menu.py")

if existing and existing.is_active:
    st.markdown("---")
    if st.button("🗄 Ngưng bán món này", type="secondary"):
        menu_mod.retire_dish(existing.id, current_role() or "admin")
        st.success("Đã ngưng món.")
        st.session_state.editing_dish_id = None
        st.switch_page("pages/07_🍰_Menu.py")
