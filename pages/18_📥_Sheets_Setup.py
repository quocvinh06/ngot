"""Sheets Setup — first-run idempotent provisioning."""
from __future__ import annotations

from pathlib import Path

import streamlit as st
import yaml

from lib import sheets_client
from lib.auth import current_role, require_admin
from lib.audit import log_action
from lib.brand_logo import render_brand_logo
from lib.i18n import t

st.set_page_config(page_title="Khởi tạo Sheet — Ngọt", page_icon="📥", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.sheets_setup"))
st.caption(
    "Đọc `data/schema.yaml` (15 tab + 2 tab nội bộ), tạo tab nào còn thiếu trong Google Sheet đã liên kết. Idempotent — chạy lại an toàn."
)

schema_path = Path(__file__).resolve().parent.parent / "data" / "schema.yaml"
if not schema_path.exists():
    st.error(f"Không tìm thấy schema tại {schema_path}")
    st.stop()

with schema_path.open("r", encoding="utf-8") as f:
    schema = yaml.safe_load(f)

tabs_spec = schema.get("tabs", {})
st.metric("Tab khai báo trong schema", len(tabs_spec))

# Compare with current Sheet
try:
    existing_tabs = sheets_client.list_tabs()
    st.metric("Tab hiện có trong Google Sheet", len(existing_tabs))
except Exception as e:  # noqa: BLE001
    st.error(f"Không kết nối được Google Sheet: {e}")
    st.info("Hãy chắc chắn rằng SHEETS_URL và service account JSON đã được cấu hình trong secrets.")
    st.stop()

missing = [name for name in tabs_spec.keys() if name not in existing_tabs]
present = [name for name in tabs_spec.keys() if name in existing_tabs]

st.subheader("Sẽ tạo")
if not missing:
    st.success("Không có tab nào cần tạo — Google Sheet đã đầy đủ.")
else:
    for name in missing:
        spec = tabs_spec[name]
        st.markdown(f"- **{name}** ({len(spec.get('headers', []))} cột)")

st.subheader("Đã có")
if present:
    for name in present:
        st.caption(f"✓ {name}")

st.markdown("---")
if missing:
    if st.button("🚀 " + t("cta.apply_schema"), type="primary"):
        created = []
        with st.spinner("Đang tạo các tab thiếu..."):
            for name in missing:
                spec = tabs_spec[name]
                try:
                    if sheets_client.ensure_tab(name, spec.get("headers", [])):
                        created.append(name)
                except Exception as e:  # noqa: BLE001
                    st.error(f"Lỗi tạo {name}: {e}")
        log_action(current_role() or "admin", "sheets.apply_schema", diff={"created": created})
        st.success(t("success.schema_applied", n=len(created)))
        st.rerun()

st.markdown("---")
st.subheader("📦 Seed dữ liệu mẫu")
st.caption("Tải các CSV trong `data/seed/` vào các tab tương ứng (idempotent — bỏ qua nếu đã có dữ liệu).")
if st.button("🌱 Chạy seed"):
    import subprocess
    import sys
    seed_path = str(Path(__file__).resolve().parent.parent / "scripts" / "seed.py")
    py = sys.executable
    try:
        proc = subprocess.run(
            [py, seed_path], capture_output=True, text=True, timeout=300
        )
        if proc.returncode == 0:
            st.success("Seed hoàn tất.")
        else:
            st.warning("Seed kết thúc với cảnh báo.")
        st.code(proc.stdout[-3000:] + ("\n--- STDERR ---\n" + proc.stderr[-1500:] if proc.stderr else ""))
    except Exception as e:  # noqa: BLE001
        st.error(f"Lỗi: {e}")
