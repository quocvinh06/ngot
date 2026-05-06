"""Two-tier shared-password auth via st.secrets.

Roles: staff (AUTH_PASSWORD), admin (ADMIN_PASSWORD).
"""
from __future__ import annotations

import os
from typing import Literal

import streamlit as st

from lib.brand_logo import render_brand_logo
from lib.i18n import t

Role = Literal["staff", "admin"]
_TEST_BYPASS_ENV = "STREAMLIT_TEST_BYPASS_AUTH"


def _get_secret(key: str, default: str = "") -> str:
    """Read from st.secrets first, env second."""
    try:
        v = st.secrets.get(key, "")
        if v:
            return str(v)
    except (FileNotFoundError, KeyError, AttributeError):
        pass
    return os.environ.get(key, default)


def _check_password(entered: str) -> Role | None:
    """Return 'admin' if matches ADMIN_PASSWORD, 'staff' if AUTH_PASSWORD, None otherwise."""
    admin_pwd = _get_secret("ADMIN_PASSWORD")
    auth_pwd = _get_secret("AUTH_PASSWORD")
    if admin_pwd and entered == admin_pwd:
        return "admin"
    if auth_pwd and entered == auth_pwd:
        return "staff"
    return None


def current_role() -> Role | None:
    """Return current session role or None."""
    return st.session_state.get("role")


def is_admin() -> bool:
    return current_role() == "admin"


def _render_signin_card() -> None:
    """Centered sign-in form. Shown when role is unset."""
    st.markdown(
        "<div style='max-width:420px;margin:4rem auto 1rem;'>", unsafe_allow_html=True
    )
    render_brand_logo("both", size_px=48)
    st.markdown(f"### {t('auth.title')}")
    st.caption(t("auth.subtitle"))
    with st.form("signin_form", clear_on_submit=False):
        pwd = st.text_input(
            t("auth.password_label"), type="password", key="signin_pwd_input"
        )
        submitted = st.form_submit_button(t("auth.submit"), use_container_width=True)
    if submitted:
        role = _check_password(pwd)
        if role is None:
            st.error(t("auth.error_wrong"))
        else:
            st.session_state.role = role
            st.session_state.signin_at = _now()
            st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)


def _now() -> str:
    from datetime import datetime

    return datetime.now().isoformat(timespec="seconds")


def require_auth() -> Role:
    """Block page render if not authed. Renders sign-in card and stops execution."""
    # Test bypass for smoke_signin.py
    if os.environ.get(_TEST_BYPASS_ENV) == "1":
        st.session_state.role = st.session_state.get("role") or "admin"
        return st.session_state.role

    role = current_role()
    if role is None:
        _render_signin_card()
        st.stop()
    return role


def require_admin() -> Role:
    """Block page render if not admin. Use after require_auth()."""
    role = require_auth()
    if role != "admin":
        st.error(t("auth.admin_required"))
        st.stop()
    return role


def signout() -> None:
    """Clear session role."""
    for k in ("role", "signin_at"):
        if k in st.session_state:
            del st.session_state[k]
