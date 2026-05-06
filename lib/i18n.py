"""i18n message loader. vi (primary) + en (fallback)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_LOCALE = "vi"
_MESSAGES: dict[str, dict[str, str]] = {}

_BASE = Path(__file__).resolve().parent.parent / "messages"


def _load() -> None:
    if _MESSAGES:
        return
    for locale in ("vi", "en"):
        path = _BASE / f"{locale}.json"
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                _MESSAGES[locale] = json.load(f)
        else:
            _MESSAGES[locale] = {}


def set_locale(locale: str) -> None:
    global _LOCALE
    if locale not in ("vi", "en"):
        return
    _LOCALE = locale


def t(key: str, **vars: Any) -> str:
    """Translate a key. Falls back to en, then to the key itself."""
    _load()
    msg = _MESSAGES.get(_LOCALE, {}).get(key)
    if msg is None:
        msg = _MESSAGES.get("en", {}).get(key, key)
    if vars:
        try:
            return msg.format(**vars)
        except (KeyError, IndexError):
            return msg
    return msg
