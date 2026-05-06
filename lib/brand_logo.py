# GENERATED — edit to customize
"""Brand logo for Ngọt — pink-gradient circle + white cake-slice glyph.

Variants: mark | wordmark | both. Render via st.markdown(unsafe_allow_html=True).
"""
from __future__ import annotations

from typing import Literal

import streamlit as st

Variant = Literal["mark", "wordmark", "both"]

_GRADIENT_FROM = "#E5A6B6"
_GRADIENT_TO = "#D17C8F"
_TEXT_COLOR = "#2C1810"


def _mark_svg(size_px: int = 32) -> str:
    return f"""
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='{size_px}' height='{size_px}'>
  <defs>
    <linearGradient id='g_ngot' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='{_GRADIENT_FROM}'/>
      <stop offset='100%' stop-color='{_GRADIENT_TO}'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='30' fill='url(#g_ngot)'/>
  <!-- cake slice glyph (triangular slice with frosting top) -->
  <path d='M16 44 L48 44 L36 22 Z' fill='#FFF8F3'/>
  <path d='M22 32 Q26 28 32 32 Q38 28 42 32 L36 22 Z' fill='#FCE7DC'/>
  <circle cx='36' cy='24' r='2' fill='{_GRADIENT_TO}'/>
</svg>
""".strip()


def render_brand_logo(
    variant: Variant = "both",
    size_px: int = 32,
    show_tagline: bool = True,
) -> None:
    """Render the brand logo via st.markdown."""
    mark = _mark_svg(size_px) if variant in ("mark", "both") else ""
    wordmark_html = ""
    if variant in ("wordmark", "both"):
        tagline_html = (
            "<div style='font-size:0.78rem;color:#80665C;margin-top:-2px;'>Pastry &amp; Cake Studio</div>"
            if show_tagline
            else ""
        )
        wordmark_html = (
            f"<div style='display:flex;flex-direction:column;justify-content:center;'>"
            f"<div style='font-weight:700;font-size:1.4rem;color:{_TEXT_COLOR};line-height:1;'>Ngọt</div>"
            f"{tagline_html}"
            f"</div>"
        )
    html = (
        "<div style='display:flex;align-items:center;gap:0.6rem;'>"
        f"{mark}"
        f"{wordmark_html}"
        "</div>"
    )
    st.markdown(html, unsafe_allow_html=True)
