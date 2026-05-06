"""Recipes — admin-only. View and edit ingredient lines per dish."""
from __future__ import annotations

from decimal import Decimal

import pandas as pd
import streamlit as st

from lib.auth import current_role, require_admin
from lib.brand_logo import render_brand_logo
from lib.i18n import t
from lib.models import Recipe
from lib.modules import inventory as inv_mod
from lib.modules import menu as menu_mod

st.set_page_config(page_title="Công thức — Ngọt", page_icon="📒", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.recipes"))
st.caption("⚠️ Khu vực bảo mật — công thức là bí mật kinh doanh.")

dishes = menu_mod.list_dishes(active_only=True)
if dishes.empty:
    st.info(t("empty.no_dishes"))
    st.stop()
ings = inv_mod.list_ingredients()
if ings.empty:
    st.info(t("empty.no_ingredients"))
    st.stop()

dish_lookup = {f"#{int(r['id'])} — {r['name_vi']}": int(r["id"]) for _, r in dishes.iterrows()}
ing_lookup = {f"#{int(r['id'])} — {r['name_vi']} ({r['unit']})": (int(r["id"]), r["unit"]) for _, r in ings.iterrows()}

choice = st.selectbox("Chọn món", list(dish_lookup.keys()))
dish_id = dish_lookup[choice]
recipes = menu_mod.recipe_for(dish_id)

st.markdown("---")
st.subheader("Công thức hiện tại")
if not recipes:
    st.info(t("empty.no_recipes"))
else:
    rows = []
    for r in recipes:
        ing = inv_mod.get_ingredient(r.ingredient_id)
        rows.append(
            {
                "#": r.id,
                "Nguyên liệu": ing.name_vi if ing else f"#{r.ingredient_id}",
                "Định lượng": f"{r.quantity} {r.unit}",
                "Ghi chú": r.notes_vi or "",
            }
        )
    st.dataframe(rows, use_container_width=True, hide_index=True)

st.markdown("---")
st.subheader("Sửa công thức (sẽ thay thế toàn bộ dòng hiện tại)")

# Build editable df from existing recipe lines
init_data = []
for r in recipes:
    init_data.append(
        {
            "ingredient_label": next(
                (k for k, (id_, _) in ing_lookup.items() if id_ == r.ingredient_id),
                list(ing_lookup.keys())[0],
            ),
            "quantity": float(r.quantity),
            "unit": r.unit,
            "notes_vi": r.notes_vi or "",
        }
    )
if not init_data:
    init_data = [
        {
            "ingredient_label": list(ing_lookup.keys())[0],
            "quantity": 100.0,
            "unit": "g",
            "notes_vi": "",
        }
    ]

df_edit = pd.DataFrame(init_data)
edited = st.data_editor(
    df_edit,
    num_rows="dynamic",
    use_container_width=True,
    column_config={
        "ingredient_label": st.column_config.SelectboxColumn(
            "Nguyên liệu", options=list(ing_lookup.keys()), required=True
        ),
        "quantity": st.column_config.NumberColumn("Định lượng", min_value=0.01, step=0.5),
        "unit": st.column_config.TextColumn("ĐVT"),
        "notes_vi": st.column_config.TextColumn("Ghi chú"),
    },
    key="recipe_editor",
)

if st.button("💾 Lưu công thức", type="primary"):
    lines = []
    for _, row in edited.iterrows():
        label = row.get("ingredient_label")
        if not label or label not in ing_lookup:
            continue
        ing_id, default_unit = ing_lookup[label]
        try:
            qty_dec = Decimal(str(row.get("quantity") or 0))
        except Exception:
            continue
        if qty_dec <= 0:
            continue
        lines.append(
            Recipe(
                dish_id=dish_id,
                ingredient_id=ing_id,
                quantity=qty_dec,
                unit=row.get("unit") or default_unit,
                notes_vi=row.get("notes_vi") or None,
            )
        )
    if not lines:
        st.error("Cần ít nhất 1 dòng công thức hợp lệ.")
    else:
        n = menu_mod.replace_recipe(dish_id, lines, current_role() or "admin")
        st.success(f"Đã cập nhật {n} dòng.")
        st.rerun()
