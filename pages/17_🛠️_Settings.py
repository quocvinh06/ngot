"""Settings — connections, bank info, shop info. Admin-only."""
from __future__ import annotations

import os
from datetime import datetime

import streamlit as st

from lib import sheets_client
from lib.auth import current_role, require_admin
from lib.audit import log_action
from lib.brand_logo import render_brand_logo
from lib.i18n import t

st.set_page_config(page_title="Cài đặt — Ngọt", page_icon="🛠️", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_admin()
st.title(t("nav.settings"))
st.caption(
    "Khoá API và secrets được lưu trong Streamlit Cloud secrets, KHÔNG ghi vào Google Sheet. Phần dưới chỉ là cấu hình hiển thị (tên, số TK, …)."
)


def _get_secret(key: str) -> str:
    try:
        v = st.secrets.get(key, "")
        if v:
            return "*** đã thiết lập ***"
    except Exception:
        pass
    return os.environ.get(key, "") and "*** đã thiết lập (env) ***" or "_(chưa thiết lập)_"


# Read current settings
current_df = sheets_client.read_tab("Settings")
current = {}
if not current_df.empty:
    for _, row in current_df.iterrows():
        k = str(row.get("key", "")).strip()
        if k:
            current[k] = row.get("value", "") or ""


def _setting_value(key: str) -> str:
    return current.get(key, "")


tab1, tab2, tab3 = st.tabs([t("settings.connection"), t("settings.bank"), t("settings.shop")])

with tab1:
    st.subheader(t("settings.connection"))
    st.write("**Sheets URL** (st.secrets[SHEETS_URL]):", _get_secret("SHEETS_URL"))
    st.write("**Gemini API key** (st.secrets[GEMINI_API_KEY]):", _get_secret("GEMINI_API_KEY"))
    st.write("**Telegram bot token** (st.secrets[TELEGRAM_BOT_TOKEN]):", _get_secret("TELEGRAM_BOT_TOKEN"))
    st.write("**Telegram chat id** (st.secrets[TELEGRAM_CHAT_ID]):", _get_secret("TELEGRAM_CHAT_ID"))

    tcol1, tcol2, tcol3 = st.columns(3)
    with tcol1:
        if st.button("🔌 Kiểm tra Sheets"):
            try:
                tabs = sheets_client.list_tabs()
                st.success(f"OK — {len(tabs)} tab.")
            except Exception as e:  # noqa: BLE001
                st.error(f"Lỗi: {e}")
    with tcol2:
        if st.button("🔌 Kiểm tra Gemini"):
            try:
                from lib.modules import assistant as assistant_mod
                cli = assistant_mod.gemini_client()
                # cheap call: list models or single token
                resp = cli.models.generate_content(
                    model="gemini-2.5-flash", contents="ping"
                )
                _ = resp.text
                st.success(t("success.connection_ok"))
            except Exception as e:  # noqa: BLE001
                st.error(f"Lỗi: {e}")
    with tcol3:
        if st.button("🔌 Kiểm tra Telegram"):
            try:
                import requests
                token = st.secrets.get("TELEGRAM_BOT_TOKEN", "") or os.environ.get(
                    "TELEGRAM_BOT_TOKEN", ""
                )
                if not token:
                    raise RuntimeError("TELEGRAM_BOT_TOKEN chưa thiết lập")
                r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
                r.raise_for_status()
                me = r.json().get("result", {})
                st.success(f"Bot: @{me.get('username', '?')}")
            except Exception as e:  # noqa: BLE001
                st.error(f"Lỗi: {e}")


def _save_settings_kv(updates: dict[str, str]) -> int:
    """Upsert each key/value into Settings tab."""
    n = 0
    for k, v in updates.items():
        # find existing
        df = sheets_client.read_tab("Settings")
        if not df.empty:
            matches = df[df["key"].astype(str) == k]
            if not matches.empty:
                row_id = int(matches.iloc[0]["id"])
                sheets_client.update_row(
                    "Settings",
                    row_id,
                    {
                        "value": v,
                        "updated_at": datetime.now().isoformat(timespec="seconds"),
                        "updated_by": current_role() or "admin",
                    },
                )
                n += 1
                continue
        sheets_client.append_row(
            "Settings",
            {
                "key": k,
                "value": v,
                "is_secret": "FALSE",
                "updated_at": datetime.now().isoformat(timespec="seconds"),
                "updated_by": current_role() or "admin",
            },
        )
        n += 1
    log_action(current_role() or "admin", "settings.update", diff={"keys": list(updates.keys())})
    return n


with tab2:
    st.subheader(t("settings.bank"))
    with st.form("bank_form"):
        bn = st.text_input(t("settings.bank_name"), value=_setting_value("bank_name"))
        ba = st.text_input(t("settings.bank_account"), value=_setting_value("bank_account_number"))
        bh = st.text_input(t("settings.bank_holder"), value=_setting_value("bank_account_holder"))
        bbin = st.text_input("Mã BIN ngân hàng (cho VietQR, ví dụ MB Bank = 970422)", value=_setting_value("bank_bin"))
        if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
            n = _save_settings_kv(
                {
                    "bank_name": bn,
                    "bank_account_number": ba,
                    "bank_account_holder": bh,
                    "bank_bin": bbin,
                }
            )
            st.success(f"Đã lưu {n} thiết lập.")
            st.rerun()

with tab3:
    st.subheader(t("settings.shop"))
    with st.form("shop_form"):
        sn = st.text_input(t("settings.shop_name"), value=_setting_value("shop_name") or "Ngọt")
        sa = st.text_input(t("settings.shop_address"), value=_setting_value("shop_address"))
        sp = st.text_input(t("settings.shop_phone"), value=_setting_value("shop_phone"))
        sc = st.text_input(t("settings.shop_cert"), value=_setting_value("shop_food_safety_cert"))
        if st.form_submit_button("💾 " + t("cta.save"), type="primary"):
            n = _save_settings_kv(
                {
                    "shop_name": sn,
                    "shop_address": sa,
                    "shop_phone": sp,
                    "shop_food_safety_cert": sc,
                }
            )
            st.success(f"Đã lưu {n} thiết lập.")
            st.rerun()
