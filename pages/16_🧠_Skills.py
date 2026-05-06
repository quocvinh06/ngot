"""Skills — admin-only AssistantSkill editor."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import streamlit as st

from lib.auth import current_role, require_admin
from lib.brand_logo import render_brand_logo
from lib.i18n import t
from lib.modules import assistant as assistant_mod

st.set_page_config(page_title="Kỹ năng — Ngọt", page_icon="🧠", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.skills"))
st.caption(
    "Cấu hình các kỹ năng của Trợ lý Ngọt. Mọi prompt đều được lưu vào Google Sheet và có thể export về `assistant_skills.md`."
)

skills = assistant_mod.list_skills()
if skills.empty:
    st.warning("Chưa có kỹ năng nào. Hãy chạy seed.py hoặc tạo mới bên dưới.")

if not skills.empty:
    skill_options = {f"{r['name']} — {r['display_name_vi']}": r for _, r in skills.iterrows()}
    pick = st.selectbox("Chọn kỹ năng", list(skill_options.keys()))
    selected = skill_options[pick].to_dict()

    with st.form("edit_skill"):
        c1, c2 = st.columns(2)
        with c1:
            name = st.text_input("Tên (kebab-case)", value=selected.get("name", ""))
        with c2:
            display = st.text_input("Tên hiển thị (vi)", value=selected.get("display_name_vi", ""))
        trigger_options = ["telegram_order", "manual_button", "scheduled", "on_event"]
        trig = st.selectbox(
            "Trigger",
            trigger_options,
            index=trigger_options.index(selected.get("trigger", "manual_button"))
            if selected.get("trigger") in trigger_options
            else 1,
        )
        event_kind = st.text_input("Event kind (nếu trigger=on_event)", value=selected.get("event_kind", ""))
        prompt = st.text_area(
            "Prompt template", value=selected.get("prompt_template", ""), height=300
        )
        schema_text = st.text_area(
            "Output schema (JSON)", value=str(selected.get("output_schema") or ""), height=120
        )
        enabled = st.toggle("Bật", value=str(selected.get("is_enabled", True)).upper() in ("TRUE", "1"))
        if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
            try:
                schema_obj = json.loads(schema_text) if schema_text.strip() else None
            except json.JSONDecodeError:
                schema_obj = None
                st.warning("Output schema không phải JSON hợp lệ — đã bỏ qua.")
            updated = {
                "id": selected.get("id"),
                "name": name,
                "display_name_vi": display,
                "trigger": trig,
                "event_kind": event_kind,
                "prompt_template": prompt,
                "output_schema": json.dumps(schema_obj) if schema_obj else "",
                "is_enabled": "TRUE" if enabled else "FALSE",
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            }
            assistant_mod.upsert_skill(updated, current_role() or "admin")
            st.success("Đã lưu kỹ năng.")
            st.rerun()

st.markdown("---")
st.subheader("📜 assistant_skills.md (file repo)")
md_path = Path(__file__).resolve().parent.parent / "assistant_skills.md"
if md_path.exists():
    with md_path.open("r", encoding="utf-8") as f:
        content = f.read()
    st.code(content[:8000], language="markdown")
else:
    st.warning("Không tìm thấy assistant_skills.md.")

st.markdown("---")
st.subheader("📒 Lịch sử gọi trợ lý (50 dòng gần nhất)")
log = assistant_mod.list_call_log(50)
if log.empty:
    st.info("Chưa có lượt gọi nào.")
else:
    cols = ["invoked_at", "skill_id", "invoked_by", "status", "latency_ms", "token_count_input", "token_count_output"]
    st.dataframe(log[[c for c in cols if c in log.columns]], use_container_width=True, hide_index=True)
