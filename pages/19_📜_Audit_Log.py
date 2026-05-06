"""Audit Log — admin-only viewer."""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import streamlit as st

from lib import sheets_client
from lib.auth import require_admin
from lib.brand_logo import render_brand_logo
from lib.i18n import t

st.set_page_config(page_title="Nhật ký — Ngọt", page_icon="📜", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.audit_log"))

df = sheets_client.read_tab("AuditLog")
if df.empty:
    st.info(t("empty.no_audit"))
    st.stop()

df = df.copy()
df["dt"] = pd.to_datetime(df["occurred_at"], errors="coerce")

# Filters
fcol1, fcol2, fcol3, fcol4 = st.columns(4)
with fcol1:
    actor = st.selectbox(
        "Vai trò",
        ["(tất cả)"] + sorted(df["actor_role"].astype(str).unique().tolist()),
    )
with fcol2:
    action = st.selectbox(
        "Hành động",
        ["(tất cả)"] + sorted(df["action"].astype(str).unique().tolist()),
    )
with fcol3:
    target = st.selectbox(
        "Đối tượng",
        ["(tất cả)"] + sorted(df["target_kind"].fillna("").astype(str).unique().tolist()),
    )
with fcol4:
    today = datetime.now().date()
    date_from = st.date_input("Từ ngày", value=today - timedelta(days=30))

filtered = df.copy()
if actor != "(tất cả)":
    filtered = filtered[filtered["actor_role"].astype(str) == actor]
if action != "(tất cả)":
    filtered = filtered[filtered["action"].astype(str) == action]
if target != "(tất cả)":
    filtered = filtered[filtered["target_kind"].astype(str) == target]
filtered = filtered[filtered["dt"].dt.date >= date_from]

filtered = filtered.sort_values("dt", ascending=False)

st.caption(f"Tìm thấy **{len(filtered)}** sự kiện.")

view = filtered[
    ["occurred_at", "actor_role", "action", "target_kind", "target_id", "diff"]
].rename(
    columns={
        "occurred_at": "Thời gian",
        "actor_role": "Vai trò",
        "action": "Hành động",
        "target_kind": "Đối tượng",
        "target_id": "ID",
        "diff": "Diff",
    }
)
st.dataframe(view, use_container_width=True, hide_index=True)
