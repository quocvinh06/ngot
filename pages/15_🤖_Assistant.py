"""Assistant — Telegram inbox + parse → review → confirm flow."""
from __future__ import annotations

import json

import pandas as pd
import streamlit as st

from lib import sheets_client
from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_datetime_vi
from lib.i18n import t
from lib.modules import assistant as assistant_mod

st.set_page_config(page_title="Trợ lý Ngọt", page_icon="🤖", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()
st.title(t("assistant.title"))
st.caption(t("assistant.subtitle"))

# Sync now button
sccol1, sccol2, sccol3 = st.columns([2, 1, 1])
with sccol1:
    last_msg = sheets_client.read_tab("TelegramMessages")
    if not last_msg.empty:
        last_dt = last_msg["received_at"].astype(str).max()
        st.caption(t("misc.last_sync", ts=format_datetime_vi(last_dt)))
with sccol3:
    if st.button("🔄 " + t("cta.sync_telegram"), type="primary", use_container_width=True):
        with st.spinner(t("info.sync_started")):
            try:
                count = assistant_mod.poll_telegram(actor=current_role() or "staff")
                st.success(t("info.sync_done", n=count))
                st.rerun()
            except Exception as e:  # noqa: BLE001
                st.error(f"Telegram error: {e}")

# Tabs by parse_status
df = sheets_client.read_tab("TelegramMessages")
if df.empty:
    st.info(t("empty.no_messages"))
    st.stop()

df = df.copy()
df["received_at_dt"] = pd.to_datetime(df["received_at"], errors="coerce")
df = df.sort_values("received_at_dt", ascending=False)

t_pending, t_review, t_done, t_all = st.tabs(
    [
        f"Chờ phân tích ({len(df[df['parse_status'] == 'pending'])})",
        f"Cần xem lại ({len(df[df['parse_status'].isin(['needs_review', 'parsed'])])})",
        f"Đã xử lý ({len(df[df['parse_status'].isin(['processed', 'ignored'])])})",
        f"Tất cả ({len(df)})",
    ]
)


def _msg_card(row, key_prefix: str):
    """Render a Telegram message card. `key_prefix` namespaces the buttons so
    the same row can appear in multiple tabs without st.button key collisions.
    """
    msg_id = int(row["id"])
    with st.container(border=True):
        h1, h2 = st.columns([3, 1])
        with h1:
            sender = row.get("sender_name", "Khách Telegram") or "Khách Telegram"
            st.markdown(f"**{sender}** — _{format_datetime_vi(row.get('received_at'))}_")
            st.markdown(f"> {row.get('raw_text', '')}")
        with h2:
            st.caption(f"Trạng thái: `{row.get('parse_status')}`")
            st.caption(f"Telegram msg #{row.get('telegram_msg_id')}")

        parsed_json = row.get("parsed_json")
        if parsed_json:
            with st.expander("Kết quả phân tích"):
                try:
                    parsed = json.loads(parsed_json)
                    st.json(parsed)
                except Exception:
                    st.code(parsed_json)

        bcol1, bcol2, bcol3, bcol4 = st.columns(4)
        with bcol1:
            if st.button(
                "🤖 Trợ lý xử lý",
                key=f"{key_prefix}_autopilot_{msg_id}",
                help="Chạy lại trợ lý AI: phân loại + tạo đơn / nhập kho / trả lời + nhắn lại Telegram.",
            ):
                with st.spinner("Trợ lý đang xử lý..."):
                    try:
                        result = assistant_mod.process_inbound_message(
                            telegram_msg_id=int(row.get("telegram_msg_id") or 0),
                            chat_id=int(row.get("chat_id") or 0),
                            sender_name=str(row.get("sender_name") or ""),
                            raw_text=str(row.get("raw_text") or ""),
                            actor=current_role() or "staff",
                        )
                        st.success(
                            f"Intent: {result['intent']} → {result['status']}"
                            + (f" (đơn #{result['related_order_id']})" if result.get("related_order_id") else "")
                        )
                        st.rerun()
                    except Exception as e:  # noqa: BLE001
                        st.error(f"Lỗi: {e}")
        with bcol2:
            if st.button("🔍 " + t("cta.parse_message"), key=f"{key_prefix}_parse_{msg_id}"):
                with st.spinner("Đang phân tích..."):
                    parsed = assistant_mod.parse_order_message(
                        row.get("raw_text", ""), actor=current_role() or "staff"
                    )
                    new_status = "needs_review" if parsed.confidence < 0.7 else "parsed"
                    sheets_client.update_row(
                        "TelegramMessages",
                        msg_id,
                        {
                            "parse_status": new_status,
                            "parsed_json": json.dumps(parsed.model_dump(), ensure_ascii=False),
                            "reviewed_by": current_role() or "staff",
                        },
                    )
                    st.success(f"Đã phân tích — confidence {parsed.confidence:.2f}")
                    st.rerun()
        with bcol3:
            if st.button("➕ " + t("cta.process_as_order"), key=f"{key_prefix}_order_{msg_id}", disabled=not parsed_json):
                if parsed_json:
                    parsed = json.loads(parsed_json)
                    st.session_state.prefill_order = {
                        "phone": parsed.get("customer_phone", ""),
                        "name": parsed.get("customer_name", ""),
                        "address": parsed.get("delivery_address", ""),
                        "items": parsed.get("items", []),
                        "notes": parsed.get("notes", ""),
                    }
                    sheets_client.update_row(
                        "TelegramMessages", msg_id, {"parse_status": "processed"}
                    )
                    st.switch_page("pages/02_➕_New_Order.py")
        with bcol4:
            if st.button("🚫 Bỏ qua", key=f"{key_prefix}_ignore_{msg_id}"):
                sheets_client.update_row(
                    "TelegramMessages", msg_id, {"parse_status": "ignored"}
                )
                st.rerun()


with t_pending:
    sub = df[df["parse_status"] == "pending"]
    if sub.empty:
        st.info("Không có tin nhắn chờ phân tích.")
    for _, row in sub.head(20).iterrows():
        _msg_card(row, key_prefix="p")

with t_review:
    sub = df[df["parse_status"].isin(["needs_review", "parsed"])]
    if sub.empty:
        st.info("Không có tin nhắn cần xem lại.")
    for _, row in sub.head(20).iterrows():
        _msg_card(row, key_prefix="r")

with t_done:
    sub = df[df["parse_status"].isin(["processed", "ignored"])]
    if sub.empty:
        st.info("Chưa có tin nhắn nào được xử lý.")
    for _, row in sub.head(20).iterrows():
        _msg_card(row, key_prefix="d")

with t_all:
    for _, row in df.head(40).iterrows():
        _msg_card(row, key_prefix="a")
